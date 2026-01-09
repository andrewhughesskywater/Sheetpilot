/**
 * Bot Orchestrator: coordinates the end-to-end automation workflow.
 *
 * This file contains the “business flow” of the bot:
 * - start Playwright (via `WebformFiller`)
 * - log in (via `LoginManager`)
 * - transform each input row into field values
 * - fill the form, then submit and verify
 * - recover from transient page issues and support cancellation
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

import * as Cfg from '../config/automation_config';
import { WebformFiller } from '../browser/webform_flow';
import { LoginManager } from '../utils/authentication_flow';
import { botLogger } from '../../utils/logger';
import { getQuarterForDate } from '../config/quarter_config';
import { appSettings } from '@sheetpilot/shared/constants';
import { checkAborted, setupAbortHandler } from '../utils/abort-utils';
import { FieldProcessor, type FieldProcessingContext } from './field-processor';

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

interface BotOrchestratorConfig {
  injected_config: typeof Cfg;
  formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] };
  headless?: boolean | null;
  browser?: string | null;
  progress_callback?: (pct: number, msg: string) => void;
}

interface ProcessRowConfig {
  row: Record<string, unknown>;
  rowIndex: number;
  totalRows: number;
  status_col: string;
  complete_val: unknown;
  abortSignal?: AbortSignal;
}

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
   * `WebformFiller.requirePage()` throws when the browser has not started.
   */
  /** Configuration object containing automation settings */
  cfg: typeof Cfg;
  /** Whether to run browser in headless mode */
  headless: boolean;
  /** Type of browser to use (chromium only) */
  browserKind: string;
  /** Webform filler instance for form interaction */
  webformFiller: WebformFiller;
  /** Login manager instance for authentication */
  loginManager: LoginManager;
  /** Optional callback for progress updates during automation */
  progress_callback: ((pct: number, msg: string) => void) | undefined;
  /** Dynamic form configuration */
  formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] };

  /**
   * Creates a new BotOrchestrator instance
   * @param config - Configuration object containing all parameters
   */
  constructor(config: BotOrchestratorConfig) {
    if (!config.formConfig) {
      throw new Error('formConfig is required. Use createFormConfig() to create a valid form configuration.');
    }

    this.cfg = config.injected_config;

    // Use the UI-controlled value when `headless` is null; otherwise trust the caller.
    const actualHeadless = config.headless ?? null;
    this.headless = actualHeadless === null ? appSettings.browserHeadless : Boolean(actualHeadless);
    botLogger.debug('BotOrchestrator initialized with headless setting', {
      headlessParam: actualHeadless,
      resolvedHeadless: this.headless,
      appSettingsBrowserHeadless: appSettings.browserHeadless
    });

    this.browserKind = config.browser ?? (this.cfg as Record<string, unknown>)['BROWSER'] as string ?? 'chromium';
    this.progress_callback = config.progress_callback;
    this.formConfig = config.formConfig;
    this.webformFiller = new WebformFiller(this.cfg, this.headless, this.browserKind, this.formConfig);
    this.loginManager = new LoginManager(this.cfg, this.webformFiller);
  }

  /**
   * Initializes the browser and starts the automation session
   * @returns Promise that resolves when browser is ready
   */
  async start(): Promise<void> { await this.webformFiller.start(); }
  
  /**
   * Closes the browser and cleans up resources
   * @returns Promise that resolves when cleanup is complete
   */
  async close(): Promise<void> { await this.webformFiller.close(); }

  /**
   * Runs the automation workflow for a batch of rows.
   *
   * - `df` is an array of rows, where each row uses column labels as keys
   *   (example: `{ Date: '01/15/2024', Project: 'OSC-BBB', Hours: 8 }`).
   * - The return value uses **indices into `df`**, not external IDs.
   * - The method supports cancellation through `AbortSignal`.
   */
  async runAutomation(df: Array<Record<string, unknown>>, creds: [string, string], abortSignal?: AbortSignal): Promise<[boolean, number[], Array<[number,string]>]> {
    const result = await this._runAutomationInternal(df, creds, abortSignal);
    return [result.success, result.submitted_indices, result.errors];
  }

  /**
   * Executes the login process with provided credentials
   * @param email - User email for authentication
   * @param password - User password for authentication
   * @returns Promise that resolves when login is complete
   */
  runLoginSteps(email: string, password: string): Promise<void> { return this.loginManager.runLoginSteps(email, password); }

  /**
   * Gets the current browser page instance
   * @returns Playwright Page object
   * @throws BotNotStartedError if browser is not started
   */
  requirePage() { return this.webformFiller.requirePage(); }

  /**
   * Waits for an element to become visible and returns its locator
   * @param sel - CSS selector for the element to wait for
   * @returns Promise resolving to Playwright Locator object
   * @throws Error if element doesn't become visible within timeout
   */
  async waitVisible(sel: string) {
    const page = this.webformFiller.requirePage();
    const ok = await Cfg.dynamic_wait_for_element(page, sel, 'visible', Cfg.DYNAMIC_WAIT_BASE_TIMEOUT, Cfg.GLOBAL_TIMEOUT);
    if (!ok) throw new Error(`Element '${sel}' did not become visible within timeout`);
    return page.locator(sel);
  }

  /**
   * Clicks an element identified by selector
   * @param sel - CSS selector for the element to click
   */
  async click(sel: string) { const page = this.webformFiller.requirePage(); await page.locator(sel).click(); }
  
  /**
   * Types text into an element identified by selector
   * @param sel - CSS selector for the input element
   * @param text - Text to type into the element
   */
  async type(sel: string, text: string) { const page = this.webformFiller.requirePage(); await page.locator(sel).type(text); }

  /**
   * Determines if a field should be processed based on its value
   * @private
   * @param fieldKey - Key identifying the field
   * @param fields - Object containing field values
   * @returns True if field should be processed, false otherwise
   */
  private _shouldProcessField(fieldKey: string, fields: Record<string, unknown>): boolean {
    const fieldValue = fields[fieldKey];
    if (fieldValue === null || fieldValue === undefined) {
      return false;
    }
    
    // Skip if field has NaN value (check for NaN specifically)
    if (typeof fieldValue === 'number' && isNaN(fieldValue)) {
      return false;
    }
    
    // Cache string conversion and lowercase to avoid repeated conversions
    const stringValue = typeof fieldValue === 'string' 
      ? fieldValue.toLowerCase() 
      : String(fieldValue).toLowerCase();
    
    if (stringValue === 'nan' || stringValue === 'none' || stringValue === '') {
      return false;
    }
    
    return true;
  }

  /**
   * Gets project-specific tool locator based on project name
   * @private
   * @param projectName - Name of the project to get tool for
   * @returns CSS selector for project-specific tool input or null if not found
   */
  private getProjectSpecificToolLocator(projectName: string): string | null {
    const map = this.cfg.PROJECT_TO_TOOL_LABEL;
    if (projectName && map[projectName]) return `input[aria-label='${map[projectName]}']`;
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
    return 20 + Math.floor(60 * (currentRow + 1) / totalRows);
  }

  /**
   * Validates that the entry date matches the quarter of the configured form
   * @private
   * @param dateValue - Date value to validate (mm/dd/yyyy format)
   * @param rowIndex - Row index for error reporting
   * @returns Error message if validation fails, null if validation passes
   */
  private _validateQuarterMatch(dateValue: unknown, rowIndex: number): string | null {
    if (!dateValue) return null;

    try {
      const dateStr = String(dateValue).trim();
      const parsed = this._parseUserDate(dateStr);

      if (!parsed) {
        return `Invalid date format: ${dateStr}. Expected mm/dd/yyyy`;
      }

      const rangeError = this._validateDateRange(parsed);
      if (rangeError) {
        return rangeError;
      }

      const quarterDef = getQuarterForDate(parsed.isoDate);
      if (quarterDef && quarterDef.formId !== this.formConfig.FORM_ID) {
        return `Date ${dateStr} belongs to ${quarterDef.name} but form configured for different quarter`;
      }

      return null;
    } catch (dateError) {
      botLogger.error('Error parsing date', { 
        rowIndex, 
        date: dateValue,
        error: dateError instanceof Error ? dateError.message : String(dateError)
      });
      return `Could not parse date: ${String(dateValue)}`;
    }
  }

  private _parseUserDate(dateStr: string): { month: number; day: number; year: number; isoDate: string } | null {
    const dateMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!dateMatch) {
      return null;
    }

    const [, monthStr, dayStr, yearStr] = dateMatch;
    const month = parseInt(monthStr ?? '', 10);
    const day = parseInt(dayStr ?? '', 10);
    const year = parseInt(yearStr ?? '', 10);

    if (isNaN(month) || isNaN(day) || isNaN(year)) {
      return null;
    }

    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { month, day, year, isoDate };
  }

  private _validateDateRange(parsed: { month: number; day: number; year: number }): string | null {
    if (parsed.month < 1 || parsed.month > 12) {
      return `Invalid month: ${parsed.month}`;
    }
    if (parsed.day < 1 || parsed.day > 31) {
      return `Invalid day: ${parsed.day}`;
    }
    if (parsed.year < 1900 || parsed.year > 2100) {
      return `Invalid year: ${parsed.year}`;
    }
    return null;
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
  private async _processRow(config: ProcessRowConfig): Promise<[boolean, string | null]> {
    const { row, rowIndex, totalRows, status_col, complete_val, abortSignal } = config;
    // Check if aborted before processing each row
    checkAborted(abortSignal, `Automation (row ${rowIndex + 1}/${totalRows})`);
    
    // Skip completed rows: callers can pass a sheet export that already includes
    // status for prior submissions.
    if (status_col in row && String(row[status_col] ?? '').trim() === complete_val) {
      const progress = this._calculateProgress(rowIndex, totalRows);
      botLogger.verbose('Skipping completed row', { rowIndex: rowIndex + 1, totalRows, progress });
      this.progress_callback?.(progress, `Skipping completed row ${rowIndex + 1}`);
      return [false, null]; // Not an error, just skipped
    }

    const rowTimer = botLogger.startTimer('row-process');
    let rowOutcome: 'success' | 'error' | 'skipped' = 'error';

    try {
    const progress = this._calculateProgress(rowIndex, totalRows);
    botLogger.verbose('Processing row', { rowIndex: rowIndex + 1, totalRows, progress });

    // Build fields from row
    const fields = this._buildFieldsFromRow(row);
    
    // Validate required fields early to avoid partial UI interactions that can leave
    // the form in an unexpected state.
    if (!this._validateRequiredFields(fields, rowIndex)) {
      botLogger.warn('Row skipped', { rowIndex, reason: 'Missing required fields' });
      rowOutcome = 'skipped';
      return [false, 'Missing required fields'];
    }

    // Validate quarter match before filling: submitting a Q3 entry to a Q4 form is
    // difficult to detect after the fact.
    if (fields['date']) {
      const quarterError = this._validateQuarterMatch(fields['date'], rowIndex);
      if (quarterError) {
        botLogger.error('Quarter validation failed', { rowIndex, error: quarterError });
        rowOutcome = 'error';
        return [false, quarterError];
      }
    }

    // Ensure the form has loaded and the network has settled before interacting.
    await this.webformFiller.waitForFormReady();

    // Fill fields
    botLogger.verbose('Filling form fields', { rowIndex });
    const fillTimer = botLogger.startTimer('row-fill');
    await this._fillFields(fields);
    fillTimer.done({ rowIndex });

    // Submit is optional: tests and debugging sometimes run in “fill-only” mode.
    if (Cfg.SUBMIT_FORM_AFTER_FILLING) {
      botLogger.verbose('Waiting for form to stabilize before submission', { rowIndex });
      // Wait for form to be stable (no ongoing animations or changes)
      await Cfg.wait_for_dom_stability(
        this.webformFiller.requirePage(),
        'form',
        'visible',
        Cfg.SUBMIT_DELAY_AFTER_FILLING,
        Cfg.SUBMIT_DELAY_AFTER_FILLING * 2
      );
      
      // Submit with retry (Initial + Level 1 + Level 2 = 3 attempts)
      const submitTimer = botLogger.startTimer('row-submit');
      const submissionSuccess = await this._submitWithRetryWithFields(rowIndex, fields);
      submitTimer.done({ rowIndex, success: submissionSuccess });
      if (!submissionSuccess) {
        rowOutcome = 'error';
        return [false, 'Form submission failed after 3 attempts (initial + Level 1 retry + Level 2 retry)'];
      }
    }

    botLogger.info('Row completed successfully', { rowIndex });
    this.progress_callback?.(this._calculateProgress(rowIndex, totalRows), `Completed row ${rowIndex + 1}`);
    rowOutcome = 'success';
    return [true, null];
    } finally {
      rowTimer.done({ rowIndex, outcome: rowOutcome });
    }
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
  private async _submitWithRetryWithFields(rowIndex: number, fields: Record<string, unknown>): Promise<boolean> {
    // Attempt 1: Initial submit
    botLogger.info('Attempting initial submission', { rowIndex, attempt: 1, retryLevel: 'initial' });
    let success = await this.webformFiller.submitForm();
    
    if (success) {
      botLogger.info('Initial submission succeeded', { rowIndex, attempt: 1, retryLevel: 'initial', result: 'success' });
      return true;
    }
    
    botLogger.warn('Initial submission failed', { rowIndex, attempt: 1, retryLevel: 'initial', result: 'failed' });
    
    // Attempt 2: Level 1 retry - quick retry, just click submit again (no form re-fill)
    const level1Delay = Cfg.SUBMIT_CLICK_RETRY_DELAY_S;
    botLogger.info('Starting Level 1 retry (quick re-click, no form re-fill)', { 
      rowIndex, 
      attempt: 2, 
      retryLevel: 'level-1', 
      delaySeconds: level1Delay 
    });
    await new Promise(resolve => setTimeout(resolve, level1Delay * 1000));
    
    botLogger.info('Attempting Level 1 retry submission', { rowIndex, attempt: 2, retryLevel: 'level-1' });
    success = await this.webformFiller.submitForm();
    
    if (success) {
      botLogger.info('Level 1 retry succeeded', { rowIndex, attempt: 2, retryLevel: 'level-1', result: 'success' });
      return true;
    }
    
    botLogger.warn('Level 1 retry failed', { rowIndex, attempt: 2, retryLevel: 'level-1', result: 'failed' });
    
    // Attempt 3: Level 2 retry - re-fill form and submit
    const level2Delay = Cfg.SUBMIT_RETRY_DELAY;
    botLogger.info('Starting Level 2 retry (re-fill form and submit)', { 
      rowIndex, 
      attempt: 3, 
      retryLevel: 'level-2', 
      delaySeconds: level2Delay 
    });
    await Cfg.wait_for_dom_stability(
      this.webformFiller.requirePage(),
      'body',
      'visible',
      level2Delay,
      level2Delay * 2
    );
    
    botLogger.verbose('Re-filling form fields for Level 2 retry', { rowIndex, retryLevel: 'level-2' });
    await this._fillFields(fields);
    
    botLogger.info('Attempting Level 2 retry submission', { rowIndex, attempt: 3, retryLevel: 'level-2' });
    success = await this.webformFiller.submitForm();
    
    if (success) {
      botLogger.info('Level 2 retry succeeded', { rowIndex, attempt: 3, retryLevel: 'level-2', result: 'success' });
      return true;
    }
    
    botLogger.error('All submission attempts exhausted', { 
      rowIndex, 
      totalAttempts: 3, 
      retryLevels: ['initial', 'level-1', 'level-2'],
      result: 'failed'
    });
    return false;
  }

  /**
   * Processes a batch of rows, handling errors and recovery
   * @private
   * @param config - Configuration object containing df, statusCol, completeVal, totalRows, and optional abortSignal
   * @returns Promise resolving to [submitted indices, failed rows]
   */
  private async _processRowBatch(
    config: {
      df: Array<Record<string, unknown>>;
      statusCol: string;
      completeVal: unknown;
      totalRows: number;
      abortSignal?: AbortSignal;
    }
  ): Promise<[number[], Array<[number, string]>]> {
    const { df, statusCol, completeVal, totalRows, abortSignal } = config;
    const submitted: number[] = [];
    const failed_rows: Array<[number, string]> = [];

    for (let i = 0; i < df.length; i++) {
      const idx = i;
      const row = df[i];
      if (!row) continue;

      try {
        const [success, errorMessage] = await this._processRow({
          row,
          rowIndex: idx,
          totalRows,
          status_col: statusCol,
          complete_val: completeVal,
          ...(abortSignal && { abortSignal })
        });

        if (!success) {
          if (errorMessage) {
            failed_rows.push([idx, errorMessage]);
          }
          continue;
        }

        submitted.push(idx);
      } catch (e: unknown) {
        const errorMsg = String((e as Error)?.message ?? e);
        botLogger.error('Row processing encountered error', { rowIndex: idx, error: errorMsg });
        failed_rows.push([idx, errorMsg]);

        try {
          await this.webformFiller.navigateToBase();
        } catch (recoveryError) {
          botLogger.warn('Recovery navigation failed', {
            rowIndex: idx,
            error: String(recoveryError)
          });
        }
      }
    }

    return [submitted, failed_rows];
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
  private async _runAutomationInternal(df: Array<Record<string, unknown>>, creds: [string, string], abortSignal?: AbortSignal): Promise<AutomationResult> {
    const [email, password] = creds;
    const submitted: number[] = [];
    const failed_rows: Array<[number, string]> = [];
    const total_rows = df.length;

    // Register an abort handler that closes the browser immediately.
    // This limits “zombie” Chromium processes when a caller cancels mid-run.
    const cleanupAbortHandler = setupAbortHandler(abortSignal, () => this.close(), 'browser');
    
    try {
      // Check if aborted before starting
      checkAborted(abortSignal, 'Automation');
      
      botLogger.info('Starting automation workflow', { 
        totalRows: total_rows, 
        email
      });
      
      // Log in once (context 0). Row processing relies on the authenticated session.
      botLogger.info('Logging in to primary context', { progress: 10 });
      this.progress_callback?.(10, 'Logging in');
      const loginTimer = botLogger.startTimer('login');
      await this.loginManager.runLoginSteps(email, password, 0);
      loginTimer.done({ contextIndex: 0 });
      
      // Check if aborted after login
      checkAborted(abortSignal, 'Automation');
      
      botLogger.info('Login complete', { progress: 20 });
      this.progress_callback?.(20, 'Login complete');

      const status_col = ((this.cfg as Record<string, unknown>)['STATUS_COLUMN_NAME'] as string) ?? 'Status';
      const complete_val = (this.cfg as Record<string, unknown>)['STATUS_COMPLETE'] ?? 'Complete';
      botLogger.info('Processing rows', { 
        totalRows: total_rows, 
        statusColumn: status_col, 
        completeValue: complete_val
      });

      // Process rows sequentially: each row expects a stable form state and
      // interacts with the same page session.
      const batchConfig: {
        df: Array<Record<string, unknown>>;
        statusCol: string;
        completeVal: unknown;
        totalRows: number;
        abortSignal?: AbortSignal;
      } = { df, statusCol: status_col, completeVal: complete_val, totalRows: total_rows };
      if (abortSignal) {
        batchConfig.abortSignal = abortSignal;
      }
      const [submitted_batch, failed_rows_batch] = await this._processRowBatch(batchConfig);
      submitted.push(...submitted_batch);
      failed_rows.push(...failed_rows_batch);

      // Log final results
      const success_count = submitted.length;
      const failure_count = failed_rows.length;
      const successRate = total_rows > 0 ? (success_count/total_rows*100).toFixed(1) : 'N/A';
      botLogger.info('Automation workflow completed', { 
        totalRows: total_rows, 
        successCount: success_count, 
        failureCount: failure_count,
        successRate: successRate + '%'
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
        errors: [[-1, `Automation failed: ${String((e as Error)?.message ?? e)}`]],
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
  private _buildFieldsFromRow(row: Record<string, unknown>): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    for (const key of Cfg.FIELD_ORDER) {
      const spec = Cfg.FIELD_DEFINITIONS[key];
      if (!spec) continue;
      const label = spec['label'];
      if (!(label in row)) continue;
      fields[key] = row[label];
    }
    return fields;
  }

  /**
   * Fills form fields with provided values
   * @private
   * @param fields - Object containing field keys and their values
   * @returns Promise that resolves when all fields are filled
   */
  private async _fillFields(fields: Record<string, unknown>): Promise<void> {
    botLogger.verbose('Processing fields for form filling', {
      fieldCount: Object.keys(fields).length,
      fields
    });

    for (const [fieldKey, value] of Object.entries(fields)) {
      const context: FieldProcessingContext = {
        webformFiller: this.webformFiller,
        fieldKey: fieldKey,
        value,
        allFields: fields,
        shouldProcessField: this._shouldProcessField.bind(this),
        getProjectSpecificToolLocator: this.getProjectSpecificToolLocator.bind(this)
      };

      await FieldProcessor.processField(context);
    }
  }

  /**
   * Validates that all required fields are present and have valid values
   * @private
   * @param fields - Object containing field values to validate
   * @param _idx - Row index (unused but kept for interface consistency)
   * @returns True if all required fields are valid, false otherwise
   */
  private _validateRequiredFields(fields: Record<string, unknown>, _idx: number): boolean {
    for (const field_key of ['hours','project_code','date']) {
      if (!(field_key in fields)) return false;
      const v = fields[field_key];
      if (v === null || v === undefined) return false;
      const s = String(v).toLowerCase();
      if (s === 'nan' || s === 'none' || s === '') return false;
    }
    return true;
  }
}

/**
 * Alias for BotOrchestrator class for backward compatibility
 * @deprecated Use BotOrchestrator directly
 */
export const TimesheetBot = BotOrchestrator;
