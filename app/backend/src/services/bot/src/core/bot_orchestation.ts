/**
 * Bot Orchestrator: coordinates the end-to-end automation workflow.
 *
 * This file contains the "business flow" of the bot using composable helpers:
 * - start Playwright (via `BrowserLauncher`)
 * - manage contexts/pages (via `WebformSessionManager`)
 * - log in (via `LoginManager`)
 * - transform each input row into field values
 * - fill the form (via `FormInteractor`), then submit and verify (via `SubmissionMonitor`)
 * - recover from transient page issues and support cancellation
 *
 * ## Composable Architecture
 * The orchestrator delegates to specialized, testable helpers rather than monolithic
 * browser management. Each helper has a clear responsibility.
 *
 * ## Index semantics
 * The bot reports **row indices** (0-based) relative to the input array passed to
 * `run_automation`. Callers who need stable IDs should map indices back to IDs
 * (see `src/utils/quarter-processing.ts` for an example).
 *
 * ## Cancellation semantics
 * `AbortSignal` cancellation throws early (via `checkAborted`) and also triggers
 * immediate browser cleanup (via `setupAbortHandler`).
 */

import * as Cfg from "../config/automation_config";
import { BrowserLauncher } from "../browser/browser_launcher";
import {
  WebformSessionManager,
  type FormConfig,
} from "../browser/webform_session";
import { FormInteractor, type FieldSpec } from "../browser/form_interactor";
import { SubmissionMonitor } from "../browser/submission_monitor";
import {
  LoginManager,
  type BrowserManager,
} from "../utils/authentication_flow";
import { botLogger } from "../../../../../../shared/logger";
import { getQuarterForDate } from "../config/quarter_config";
import { appSettings } from "../../../../../../shared/constants";
import { checkAborted, setupAbortHandler } from "../utils/abort-utils";

/**
 * Result object returned after automation execution
 * @interface AutomationResult
 */
export type AutomationResult = {
  /** Whether the automation completed successfully (at least one row processed) */
  success: boolean;
  /** Array of row indices that were successfully submitted */
  submitted_indices: number[];
  /** Array of [row_index, error_message] tuples for failed rows */
  errors: Array<[number, string]>;
  /** Total number of rows processed */
  total_rows: number;
  /** Number of successfully submitted rows */
  success_count: number;
  /** Number of failed rows */
  failure_count: number;
};

/**
 * Main orchestrator class for timesheet automation.
 *
 * Keep this class focused on workflow decisions (“what happens next”).
 * Delegate browser details (selectors, waits, submission verification) to the
 * browser/auth layers so you can change UI tactics without rewriting flow.
 */
export class BotOrchestrator {
  /**
   * Invariant: call `start()` before any method that requires a page/context.
   */
  /** Configuration object containing automation settings */
  cfg: typeof Cfg;
  /** Whether to run browser in headless mode */
  headless: boolean;
  /** Browser launcher instance */
  browserLauncher: BrowserLauncher;
  /** Session manager for contexts and pages */
  sessionManager: WebformSessionManager | null = null;
  /** Form interactor for field filling */
  formInteractor: FormInteractor | null = null;
  /** Login manager instance for authentication */
  login_manager: LoginManager | null = null;
  /** Optional callback for progress updates during automation */
  progress_callback: ((pct: number, msg: string) => void) | undefined;
  /** Dynamic form configuration */
  formConfig: FormConfig;

  /**
   * Creates a new BotOrchestrator instance
   * @param injected_config - Configuration object for automation settings
   * @param formConfig - Dynamic form configuration (required)
   * @param headless - Whether to run browser in headless mode (default: null = use appSettings.browserHeadless)
   * @param _browser - Browser type to use (deprecated, ignored)
   * @param progress_callback - Optional callback for progress updates
   */
  constructor(
    injected_config: typeof Cfg,
    formConfig: FormConfig,
    headless: boolean | null = null,
    _browser: string | null = null,
    progress_callback?: (pct: number, msg: string) => void
  ) {
    if (!formConfig) {
      throw new Error(
        "formConfig is required. Use createFormConfig() to create a valid form configuration."
      );
    }
    this.cfg = injected_config;
    // Use the UI-controlled value when `headless` is null; otherwise trust the caller.
    this.headless =
      headless === null ? appSettings.browserHeadless : Boolean(headless);
    botLogger.debug("BotOrchestrator initialized with composable helpers", {
      headlessParam: headless,
      resolvedHeadless: this.headless,
      appSettingsBrowserHeadless: appSettings.browserHeadless,
    });
    this.progress_callback = progress_callback;
    this.formConfig = formConfig;
    this.browserLauncher = new BrowserLauncher(this.headless);
  }

  /**
   * Initializes the browser and starts the automation session using composable helpers
   * @returns Promise that resolves when browser is ready
   */
  async start(): Promise<void> {
    const timer = botLogger.startTimer("orchestrator-start");
    try {
      botLogger.info("Starting BotOrchestrator with composable helpers");

      // Launch browser using BrowserLauncher
      const browser = await this.browserLauncher.launch();
      botLogger.debug("Browser launched successfully");

      // Initialize session manager for context/page management
      this.sessionManager = new WebformSessionManager(browser, this.formConfig);
      await this.sessionManager.initContexts(1);
      botLogger.debug("Session manager initialized with 1 context");

      // Navigate to the form BASE_URL before doing anything else
      // This ensures pages have actual content to interact with
      botLogger.info("Navigating to form base URL", {
        baseUrl: this.formConfig.BASE_URL,
      });
      await this.sessionManager.navigateToBase(0);
      botLogger.debug("Successfully navigated to form base URL");

      // Initialize form interactor for field filling
      this.formInteractor = new FormInteractor(() =>
        this.sessionManager!.getDefaultPage()
      );
      botLogger.debug("Form interactor initialized");

      // Create a BrowserManager adapter for LoginManager
      const browserManagerAdapter: BrowserManager = {
        require_page: () => this.sessionManager!.getDefaultPage(),
        getPage: (index: number) => this.sessionManager!.getSessionPage(index),
        formConfig: this.formConfig,
      };

      // Initialize login manager with browser manager adapter
      this.login_manager = new LoginManager(this.cfg, browserManagerAdapter);
      botLogger.debug("Login manager initialized");

      botLogger.info("BotOrchestrator started successfully");
      timer.done({ success: true });
    } catch (err) {
      timer.done({ success: false, error: String(err) });
      throw err;
    }
  }

  /**
   * Closes the browser and cleans up resources
   * @returns Promise that resolves when cleanup is complete
   */
  async close(): Promise<void> {
    botLogger.info("Closing BotOrchestrator and all composable helpers");
    try {
      await this.sessionManager?.closeAll();
      await this.browserLauncher.closeAll();
      botLogger.info("Browser and all sessions closed successfully");
    } finally {
      this.sessionManager = null;
      this.formInteractor = null;
      this.login_manager = null;
    }
  }

  /**
   * Runs the automation workflow for a batch of rows.
   *
   * - `df` is an array of rows, where each row uses column labels as keys
   *   (example: `{ Date: '01/15/2024', Project: 'OSC-BBB', Hours: 8 }`).
   * - The return value uses **indices into `df`**, not external IDs.
   * - The method supports cancellation through `AbortSignal`.
   */
  async run_automation(
    df: Array<Record<string, unknown>>,
    creds: [string, string],
    abortSignal?: AbortSignal
  ): Promise<[boolean, number[], Array<[number, string]>]> {
    const result = await this._run_automation_internal(df, creds, abortSignal);
    return [result.success, result.submitted_indices, result.errors];
  }

  /**
   * Executes the login process with provided credentials
   * @param email - User email for authentication
   * @param password - User password for authentication
   * @returns Promise that resolves when login is complete
   */
  run_login_steps(email: string, password: string): Promise<void> {
    if (!this.login_manager) {
      throw new Error("Login manager not initialized. Call start() first.");
    }
    return this.login_manager.run_login_steps(email, password);
  }

  /**
   * Gets the current browser page instance
   * @returns Playwright Page object
   * @throws Error if session manager not initialized
   */
  require_page() {
    if (!this.sessionManager)
      throw new Error("Session manager not initialized");
    return this.sessionManager.getDefaultPage();
  }

  /**
   * Waits for an element to become visible and returns its locator
   * @param sel - CSS selector for the element to wait for
   * @returns Promise resolving to Playwright Locator object
   * @throws Error if element doesn't become visible within timeout
   */
  async wait_visible(sel: string) {
    const page = this.require_page();
    const ok = await Cfg.dynamic_wait_for_element(
      page,
      sel,
      "visible",
      Cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
      Cfg.GLOBAL_TIMEOUT,
      `element visibility (${sel})`
    );
    if (!ok)
      throw new Error(`Element '${sel}' did not become visible within timeout`);
    return page.locator(sel);
  }

  /**
   * Clicks an element identified by selector
   * @param sel - CSS selector for the element to click
   */
  async click(sel: string) {
    const page = this.require_page();
    await page.locator(sel).click();
  }

  /**
   * Types text into an element identified by selector
   * @param sel - CSS selector for the input element
   * @param text - Text to type into the element
   */
  async type(sel: string, text: string) {
    const page = this.require_page();
    await page.locator(sel).type(text);
  }

  /**
   * Determines if a field should be processed based on its value
   * @private
   * @param field_key - Key identifying the field
   * @param fields - Object containing field values
   * @returns True if field should be processed, false otherwise
   */
  private _should_process_field(
    field_key: string,
    fields: Record<string, unknown>
  ): boolean {
    const fieldValue = fields[field_key];
    if (fieldValue === null || fieldValue === undefined) {
      return false;
    }

    // Skip if field has NaN value (check for NaN specifically)
    if (typeof fieldValue === "number" && isNaN(fieldValue)) {
      return false;
    }

    // Cache string conversion and lowercase to avoid repeated conversions
    const stringValue =
      typeof fieldValue === "string"
        ? fieldValue.toLowerCase()
        : String(fieldValue).toLowerCase();

    if (stringValue === "nan" || stringValue === "none" || stringValue === "") {
      return false;
    }

    return true;
  }

  /**
   * Gets project-specific tool locator based on project name
   * @private
   * @param project_name - Name of the project to get tool for
   * @returns CSS selector for project-specific tool input or null if not found
   */
  private get_project_specific_tool_locator(
    project_name: string
  ): string | null {
    const map = this.cfg.PROJECT_TO_TOOL_LABEL;
    if (project_name && map[project_name])
      return `input[aria-label='${map[project_name]}']`;
    return null;
  }

  /**
   * Calculates progress percentage for row processing
   * @private
   * @param currentRow - Current row index (0-based)
   * @param totalRows - Total number of rows
   * @returns Progress percentage (0-100)
   */
  private _calculateProgress(currentRow: number, totalRows: number): number {
    return 20 + Math.floor((60 * (currentRow + 1)) / totalRows);
  }

  /**
   * Parses a date string and converts it to ISO format (YYYY-MM-DD)
   * @private
   * @param dateValue - Date value to parse (mm/dd/yyyy format)
   * @param rowIndex - Row index for error reporting
   * @returns Object with isoDate string if successful, error message if failed
   */
  private _parseDateToISO(
    dateValue: unknown,
    rowIndex: number
  ): { isoDate: string; error: null } | { isoDate: null; error: string } {
    try {
      const dateStr = String(dateValue).trim();

      // Support multiple human-entered date formats: mm/dd/yyyy, m/d/yyyy, mm-dd-yyyy, etc.
      // Quarter routing uses `YYYY-MM-DD`, so we convert.
      const dateMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (!dateMatch) {
        return {
          isoDate: null,
          error: `Invalid date format: ${dateStr}. Expected mm/dd/yyyy`,
        };
      }

      const [, monthStr, dayStr, yearStr] = dateMatch;
      if (!monthStr || !dayStr || !yearStr) {
        return {
          isoDate: null,
          error: `Invalid date format: ${dateStr}. Expected mm/dd/yyyy`,
        };
      }

      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      const year = parseInt(yearStr, 10);

      // Validate date ranges
      if (
        isNaN(month) ||
        isNaN(day) ||
        isNaN(year) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        year < 1900 ||
        year > 2100
      ) {
        return { isoDate: null, error: `Invalid date values: ${dateStr}` };
      }

      const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      return { isoDate, error: null };
    } catch (dateError) {
      botLogger.error("Error parsing date", {
        rowIndex,
        date: dateValue,
        error:
          dateError instanceof Error ? dateError.message : String(dateError),
      });
      return {
        isoDate: null,
        error: `Could not parse date: ${String(dateValue)}`,
      };
    }
  }

  /**
   * Validates that the entry date matches the quarter of the configured form
   * @private
   * @param dateValue - Date value to validate (mm/dd/yyyy format)
   * @param rowIndex - Row index for error reporting
   * @returns Error message if validation fails, null if validation passes
   */
  private _validateQuarterMatch(
    dateValue: unknown,
    rowIndex: number
  ): string | null {
    if (!dateValue) return null;

    const parseResult = this._parseDateToISO(dateValue, rowIndex);
    if (parseResult.error) {
      return parseResult.error;
    }

    if (!parseResult.isoDate) {
      return `Could not parse date: ${String(dateValue)}`;
    }

    const quarterDef = getQuarterForDate(parseResult.isoDate);

    if (quarterDef && quarterDef.formId !== this.formConfig.FORM_ID) {
      // Protect against "wrong quarter form" submissions: a date in Q3 should not
      // submit to a Q4 form (or vice versa). This check intentionally blocks.
      const dateStr = String(dateValue).trim();
      return `Date ${dateStr} belongs to ${quarterDef.name} but form configured for different quarter`;
    }

    return null;
  }

  /**
   * Attempts to recover from a row processing error by navigating back to the base form URL
   * @private
   * @param rowIndex - Row index for logging
   */
  private async _attemptRecovery(rowIndex: number): Promise<void> {
    try {
      botLogger.info("Attempting recovery", { rowIndex });
      const page = this.require_page();
      await page.goto(this.formConfig.BASE_URL, {
        timeout: Cfg.GLOBAL_TIMEOUT * 1000,
      });
    } catch (recoveryError) {
      botLogger.error("Could not recover from page error", {
        rowIndex,
        recoveryError: String(recoveryError),
      });
    }
  }

  /**
   * Processes one row through the workflow: validate → fill → (optional) submit.
   *
   * Return semantics:
   * - `[true, null]` means the bot submitted (or completed) the row successfully.
   * - `[false, null]` means the bot skipped the row (typically “already complete”).
   * - `[false, string]` means the row did not complete and the string explains why.
   * @private
   * @param row - Row data to process
   * @param rowIndex - Index of the row
   * @param totalRows - Total number of rows for progress calculation
   * @param status_col - Status column name
   * @param complete_val - Complete status value
   * @param abortSignal - Optional abort signal
   * @returns Tuple of [success: boolean, errorMessage: string | null]
   */
  private async _processRow(
    row: Record<string, unknown>,
    rowIndex: number,
    totalRows: number,
    status_col: string,
    complete_val: unknown,
    abortSignal?: AbortSignal
  ): Promise<[boolean, string | null]> {
    // Check if aborted before processing each row
    checkAborted(abortSignal, `Automation (row ${rowIndex + 1}/${totalRows})`);

    // Skip completed rows: callers can pass a sheet export that already includes
    // status for prior submissions.
    if (
      status_col in row &&
      String(row[status_col] ?? "").trim() === complete_val
    ) {
      const progress = this._calculateProgress(rowIndex, totalRows);
      botLogger.verbose("Skipping completed row", {
        rowIndex: rowIndex + 1,
        totalRows,
        progress,
      });
      this.progress_callback?.(
        progress,
        `Skipping completed row ${rowIndex + 1}`
      );
      return [false, null]; // Not an error, just skipped
    }

    const rowTimer = botLogger.startTimer("row-process");
    let rowOutcome: "success" | "error" | "skipped" = "error";

    try {
      const progress = this._calculateProgress(rowIndex, totalRows);
      botLogger.verbose("Processing row", {
        rowIndex: rowIndex + 1,
        totalRows,
        progress,
      });

      // Build fields from row
      const fields = this._build_fields_from_row(row);

      // Validate required fields early to avoid partial UI interactions that can leave
      // the form in an unexpected state.
      if (!this._validate_required_fields(fields, rowIndex)) {
        botLogger.warn("Row skipped", {
          rowIndex,
          reason: "Missing required fields",
        });
        rowOutcome = "skipped";
        return [false, "Missing required fields"];
      }

      // Validate quarter match before filling: submitting a Q3 entry to a Q4 form is
      // difficult to detect after the fact.
      if (fields["date"]) {
        const quarterError = this._validateQuarterMatch(
          fields["date"],
          rowIndex
        );
        if (quarterError) {
          botLogger.error("Quarter validation failed", {
            rowIndex,
            error: quarterError,
          });
          rowOutcome = "error";
          return [false, quarterError];
        }
      }

      // Ensure the form has loaded and the network has settled before interacting.
      await this.sessionManager!.waitForFormReady();

      // Fill fields
      botLogger.verbose("Filling form fields", { rowIndex });
      const fillTimer = botLogger.startTimer("row-fill");
      await this._fill_fields(fields);
      fillTimer.done({ rowIndex });

      // Submit is optional: tests and debugging sometimes run in "fill-only" mode.
      if (Cfg.SUBMIT_FORM_AFTER_FILLING) {
        // Submit with retry (Initial + Level 1 + Level 2 = 3 attempts)
        const submitTimer = botLogger.startTimer("row-submit");
        const submissionSuccess = await this._submitWithRetryWithFields(
          rowIndex,
          fields
        );
        submitTimer.done({ rowIndex, success: submissionSuccess });
        if (!submissionSuccess) {
          rowOutcome = "error";
          return [
            false,
            "Form submission failed after 3 attempts (initial + Level 1 retry + Level 2 retry)",
          ];
        }
      }

      botLogger.info("Row completed successfully", { rowIndex });
      this.progress_callback?.(
        this._calculateProgress(rowIndex, totalRows),
        `Completed row ${rowIndex + 1}`
      );
      rowOutcome = "success";
      return [true, null];
    } finally {
      rowTimer.done({ rowIndex, outcome: rowOutcome });
    }
  }

  /**
   * Attempts initial form submission
   * @private
   * @param monitor - SubmissionMonitor instance
   * @param rowIndex - Row index for logging
   * @returns Promise resolving to true if submission succeeded, false otherwise
   */
  private async _attemptInitialSubmission(
    monitor: SubmissionMonitor,
    rowIndex: number
  ): Promise<boolean> {
    botLogger.info("Attempting initial submission", {
      rowIndex,
      attempt: 1,
      retryLevel: "initial",
    });
    const success = await monitor.submitForm();

    if (success) {
      botLogger.info("Initial submission succeeded", {
        rowIndex,
        attempt: 1,
        retryLevel: "initial",
        result: "success",
      });
      return true;
    }

    botLogger.warn("Initial submission failed", {
      rowIndex,
      attempt: 1,
      retryLevel: "initial",
      result: "failed",
    });
    return false;
  }

  /**
   * Attempts Level 1 retry submission (quick re-click, no form re-fill)
   * @private
   * @param monitor - SubmissionMonitor instance
   * @param rowIndex - Row index for logging
   * @returns Promise resolving to true if submission succeeded, false otherwise
   */
  private async _attemptLevel1Retry(
    monitor: SubmissionMonitor,
    rowIndex: number
  ): Promise<boolean> {
    const level1Delay = Cfg.SUBMIT_CLICK_RETRY_DELAY_S;
    botLogger.info("Starting Level 1 retry (quick re-click, no form re-fill)", {
      rowIndex,
      attempt: 2,
      retryLevel: "level-1",
      delaySeconds: level1Delay,
    });
    await new Promise((resolve) => setTimeout(resolve, level1Delay * 1000));

    botLogger.info("Attempting Level 1 retry submission", {
      rowIndex,
      attempt: 2,
      retryLevel: "level-1",
    });
    const success = await monitor.submitForm();

    if (success) {
      botLogger.info("Level 1 retry succeeded", {
        rowIndex,
        attempt: 2,
        retryLevel: "level-1",
        result: "success",
      });
      return true;
    }

    botLogger.warn("Level 1 retry failed", {
      rowIndex,
      attempt: 2,
      retryLevel: "level-1",
      result: "failed",
    });
    return false;
  }

  /**
   * Attempts Level 2 retry submission (re-fill form and submit)
   * @private
   * @param monitor - SubmissionMonitor instance
   * @param rowIndex - Row index for logging
   * @param fields - Fields to fill for Level 2 retry
   * @returns Promise resolving to true if submission succeeded, false otherwise
   */
  private async _attemptLevel2Retry(
    monitor: SubmissionMonitor,
    rowIndex: number,
    fields: Record<string, unknown>
  ): Promise<boolean> {
    const level2Delay = Cfg.SUBMIT_RETRY_DELAY;
    botLogger.info("Starting Level 2 retry (re-fill form and submit)", {
      rowIndex,
      attempt: 3,
      retryLevel: "level-2",
      delaySeconds: level2Delay,
    });
    await Cfg.wait_for_dom_stability(
      this.require_page(),
      "body",
      "visible",
      level2Delay,
      level2Delay * 2,
      "page stabilization before Level 2 retry"
    );

    botLogger.verbose("Re-filling form fields for Level 2 retry", {
      rowIndex,
      retryLevel: "level-2",
    });
    await this._fill_fields(fields);

    botLogger.info("Attempting Level 2 retry submission", {
      rowIndex,
      attempt: 3,
      retryLevel: "level-2",
    });
    const success = await monitor.submitForm();

    if (success) {
      botLogger.info("Level 2 retry succeeded", {
        rowIndex,
        attempt: 3,
        retryLevel: "level-2",
        result: "success",
      });
      return true;
    }

    return false;
  }

  /**
   * Submits form with two-level retry logic:
   * - Level 1 retry: Quick retry - just click submit again after 1s delay (no form re-fill)
   * - Level 2 retry: Full retry - re-fill form and submit after 2s delay
   *
   * Flow: Initial → failed → Level 1 retry → failed → Level 2 retry → failed → give up
   *
   * @private
   * @param rowIndex - Row index for logging
   * @param fields - Fields to fill if Level 2 retry is needed
   * @returns Promise resolving to true if submission succeeded, false otherwise
   */
  private async _submitWithRetryWithFields(
    rowIndex: number,
    fields: Record<string, unknown>
  ): Promise<boolean> {
    const monitor = new SubmissionMonitor(() => this.require_page());

    // Attempt 1: Initial submit
    let success = await this._attemptInitialSubmission(monitor, rowIndex);
    if (success) {
      return true;
    }

    // Attempt 2: Level 1 retry - quick retry, just click submit again (no form re-fill)
    success = await this._attemptLevel1Retry(monitor, rowIndex);
    if (success) {
      return true;
    }

    // Attempt 3: Level 2 retry - re-fill form and submit
    success = await this._attemptLevel2Retry(monitor, rowIndex, fields);
    if (success) {
      return true;
    }

    botLogger.error("All submission attempts exhausted", {
      rowIndex,
      totalAttempts: 3,
      retryLevels: ["initial", "level-1", "level-2"],
      result: "failed",
    });
    return false;
  }

  /**
   * Implements the core automation workflow and returns a richer result object.
   *
   * Notes:
   * - The workflow logs into context 0 once, then processes rows sequentially.
   *   This avoids cross-row state bleed and keeps the UI in a predictable state.
   * - `AutomationResult.success` currently means “at least one row submitted”.
   *   A run that skips all rows (already complete) returns `success: false` but
   *   does not imply a system error.
   * @private
   * @param df - Array of data rows to process
   * @param creds - Authentication credentials [email, password]
   * @param abortSignal - Optional abort signal for cancellation support
   * @returns Promise resolving to detailed automation results
   */
  private async _run_automation_internal(
    df: Array<Record<string, unknown>>,
    creds: [string, string],
    abortSignal?: AbortSignal
  ): Promise<AutomationResult> {
    const [email, password] = creds;
    const submitted: number[] = [];
    const failed_rows: Array<[number, string]> = [];
    const total_rows = df.length;

    // Register an abort handler that closes the browser immediately.
    // This limits “zombie” Chromium processes when a caller cancels mid-run.
    const cleanupAbortHandler = setupAbortHandler(
      abortSignal,
      () => this.close(),
      "browser"
    );

    try {
      // Check if aborted before starting
      checkAborted(abortSignal, "Automation");

      botLogger.info("Starting automation workflow", {
        totalRows: total_rows,
        email,
      });

      // Log in once (context 0). Row processing relies on the authenticated session.
      botLogger.info("Logging in to primary context", { progress: 10 });
      this.progress_callback?.(10, "Logging in");
      const loginTimer = botLogger.startTimer("login");
      if (!this.login_manager) {
        throw new Error("Login manager not initialized");
      }
      await this.login_manager.run_login_steps(email, password, 0);
      loginTimer.done({ contextIndex: 0 });

      // Check if aborted after login
      checkAborted(abortSignal, "Automation");

      botLogger.info("Login complete", { progress: 20 });
      this.progress_callback?.(20, "Login complete");

      const status_col =
        ((this.cfg as Record<string, unknown>)[
          "STATUS_COLUMN_NAME"
        ] as string) ?? "Status";
      const complete_val =
        (this.cfg as Record<string, unknown>)["STATUS_COMPLETE"] ?? "Complete";
      botLogger.info("Processing rows", {
        totalRows: total_rows,
        statusColumn: status_col,
        completeValue: complete_val,
      });

      // Process rows sequentially: each row expects a stable form state and
      // interacts with the same page session.
      for (let i = 0; i < df.length; i++) {
        const idx = i; // Using array index as row identifier
        const row = df[i];
        if (!row) continue;

        try {
          const [success, errorMessage] = await this._processRow(
            row,
            idx,
            total_rows,
            status_col,
            complete_val,
            abortSignal
          );

          if (!success) {
            if (errorMessage) {
              failed_rows.push([idx, errorMessage]);
            }
            // If errorMessage is null, the row was skipped (e.g., completed), which is not an error
            continue;
          }

          submitted.push(idx);
        } catch (e: unknown) {
          const errorMsg = String((e as Error)?.message ?? e);
          botLogger.error("Row processing encountered error", {
            rowIndex: idx,
            error: errorMsg,
          });

          failed_rows.push([idx, errorMsg]);

          // Attempt to recover by returning to the base form URL. This provides
          // a clean starting point for the next row after transient UI errors.
          await this._attemptRecovery(idx);
        }
      }

      // Log final results
      const success_count = submitted.length;
      const failure_count = failed_rows.length;
      const successRate =
        total_rows > 0
          ? ((success_count / total_rows) * 100).toFixed(1)
          : "N/A";
      botLogger.info("Automation workflow completed", {
        totalRows: total_rows,
        successCount: success_count,
        failureCount: failure_count,
        successRate: successRate + "%",
      });

      return {
        success: submitted.length > 0,
        submitted_indices: submitted,
        errors: failed_rows,
        total_rows,
        success_count: submitted.length,
        failure_count: failed_rows.length,
      };
    } catch (e: unknown) {
      return {
        success: false,
        submitted_indices: [],
        errors: [
          [-1, `Automation failed: ${String((e as Error)?.message ?? e)}`],
        ],
        total_rows,
        success_count: 0,
        failure_count: total_rows,
      };
    } finally {
      // Clean up abort listener
      if (cleanupAbortHandler) {
        cleanupAbortHandler();
      }
    }
  }

  /**
   * Builds field mapping from a data row using field definitions
   * @private
   * @param row - Data row containing column label -> value mappings
   * @returns Object with field keys mapped to their values
   */
  private _build_fields_from_row(
    row: Record<string, unknown>
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    for (const key of Cfg.FIELD_ORDER) {
      const spec = Cfg.FIELD_DEFINITIONS[key];
      if (!spec) continue;
      const label = spec["label"];
      if (!(label in row)) continue;
      fields[key] = row[label];
    }
    return fields;
  }

  /**
   * Processes a single field during form filling
   * @private
   * @param field_key - Field key to process
   * @param value - Field value
   * @param fields - All field values
   * @param fillStats - Statistics object to update
   * @returns Promise that resolves to true if field was processed, false if skipped
   * @throws Error if field processing fails
   */
  private async _processField(
    field_key: string,
    value: unknown,
    fields: Record<string, unknown>,
    fillStats: { skipped: number; filled: number; failed: number }
  ): Promise<boolean> {
    let specBase: Record<string, unknown> | undefined;
    try {
      specBase = Cfg.FIELD_DEFINITIONS[field_key] as unknown as Record<
        string,
        unknown
      >;
      if (!specBase) {
        botLogger.verbose("Field specification not found", {
          fieldKey: field_key,
        });
        fillStats.skipped++;
        return false;
      }

      // Skip empty values
      if (!this._should_process_field(field_key, fields)) {
        botLogger.verbose("Skipping field with empty/invalid value", {
          fieldKey: field_key,
          value: String(value),
          reason: 'Empty, null, NaN, or "none"',
        });
        fillStats.skipped++;
        return false;
      }

      const spec = { ...specBase };

      // Use project-specific locator for tool field if available
      if (field_key === "tool") {
        const project_name = String(fields["project_code"] ?? "Unknown");
        const project_specific_locator =
          this.get_project_specific_tool_locator(project_name);
        if (project_specific_locator) {
          spec["locator"] = project_specific_locator;
          botLogger.verbose("Using project-specific tool locator", {
            fieldKey: field_key,
            projectName: project_name,
            locator: project_specific_locator,
          });
        }
      }

      // Log field specification for debugging
      botLogger.info(`[FIELD_LOOP] Processing field: ${field_key}`, {
        fieldKey: field_key,
        label: spec["label"] || "No label",
        locator: spec["locator"] || "No locator",
        value: String(value).substring(0, 100),
        valueType: typeof value,
      });

      // Inject the field value using FormInteractor
      botLogger.info(`[INJECT_START] About to inject ${field_key}`, {
        fieldKey: field_key,
        valueLength: String(value).length,
      });
      await this.formInteractor!.fillField(spec as FieldSpec, String(value));

      fillStats.filled++;
      botLogger.info(`[INJECT_SUCCESS] Successfully injected ${field_key}`, {
        fieldKey: field_key,
      });
      return true;
    } catch (error) {
      fillStats.failed++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      botLogger.error(`❌ [INJECT_ERROR] Failed to fill ${field_key}`, {
        fieldKey: field_key,
        value: String(value).substring(0, 50),
        valueType: typeof value,
        fieldLabel: specBase ? String(specBase["label"]) : "Unknown",
        fieldLocator: specBase ? String(specBase["locator"]) : "Unknown",
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
      });
      throw error;
    }
  }

  /**
   * Fills form fields with provided values
   * @private
   * @param fields - Object containing field keys and their values
   * @returns Promise that resolves when all fields are filled
   */
  private async _fill_fields(fields: Record<string, unknown>): Promise<void> {
    const fieldKeys = Object.keys(fields);
    botLogger.info("🔵 [FILL_FIELDS_START] Starting form field filling", {
      fieldCount: fieldKeys.length,
      fieldKeys: fieldKeys.join(", "),
      fieldOrder: Cfg.FIELD_ORDER,
    });

    const fillStats = {
      total: fieldKeys.length,
      processed: 0,
      skipped: 0,
      filled: 0,
      failed: 0,
    };

    for (const [field_key, value] of Object.entries(fields)) {
      botLogger.info(
        `\n📍 [FIELD_${field_key.toUpperCase()}] ════════════════════════════════════════`,
        {
          field: field_key,
          value: String(value).substring(0, 50),
        }
      );
      await this._processField(field_key, value, fields, fillStats);
    }

    botLogger.info(
      `✅ [FILL_ALL_COMPLETE] All fields filled. Total=${fillStats.total}, Filled=${fillStats.filled}, Failed=${fillStats.failed}, Skipped=${fillStats.skipped}`,
      {
        total: fillStats.total,
        processed: fillStats.filled + fillStats.failed,
        filled: fillStats.filled,
        skipped: fillStats.skipped,
        failed: fillStats.failed,
      }
    );
  }

  /**
   * Validates that all required fields are present and have valid values
   * @private
   * @param fields - Object containing field values to validate
   * @param _idx - Row index (unused but kept for interface consistency)
   * @returns True if all required fields are valid, false otherwise
   */
  private _validate_required_fields(
    fields: Record<string, unknown>,
    _idx: number
  ): boolean {
    for (const field_key of ["hours", "project_code", "date"]) {
      if (!(field_key in fields)) return false;
      const v = fields[field_key];
      if (v === null || v === undefined) return false;
      const s = String(v).toLowerCase();
      if (s === "nan" || s === "none" || s === "") return false;
    }
    return true;
  }
}

/**
 * Alias for BotOrchestrator class for backward compatibility
 * @deprecated Use BotOrchestrator directly
 */
export const TimesheetBot = BotOrchestrator;
