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
import { botLogger } from '@sheetpilot/shared/logger';
import { getQuarterForDate } from '../config/quarter_config';
import { appSettings } from '@sheetpilot/shared/constants';
import { checkAborted, setupAbortHandler } from '../utils/abort-utils';

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
   * `WebformFiller.require_page()` throws when the browser has not started.
   */
  /** Configuration object containing automation settings */
  cfg: typeof Cfg;
  /** Whether to run browser in headless mode */
  headless: boolean;
  /** Type of browser to use (chromium only) */
  browser_kind: string;
  /** Webform filler instance for form interaction */
  webform_filler: WebformFiller;
  /** Login manager instance for authentication */
  login_manager: LoginManager;
  /** Optional callback for progress updates during automation */
  progress_callback: ((pct: number, msg: string) => void) | undefined;
  /** Dynamic form configuration */
  formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] };

  /**
   * Creates a new BotOrchestrator instance
   * @param injected_config - Configuration object for automation settings
   * @param formConfig - Dynamic form configuration (required)
   * @param headless - Whether to run browser in headless mode (default: null = use appSettings.browserHeadless)
   * @param browser - Browser type to use (must be 'chromium')
   * @param progress_callback - Optional callback for progress updates
   */
  constructor(
    injected_config: typeof Cfg,
    formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] },
    headless: boolean | null = null,
    browser: string | null = null,
    progress_callback?: (pct: number, msg: string) => void
  ) {
    if (!formConfig) {
      throw new Error('formConfig is required. Use createFormConfig() to create a valid form configuration.');
    }
    this.cfg = injected_config;
    // Use the UI-controlled value when `headless` is null; otherwise trust the caller.
    this.headless = headless === null ? appSettings.browserHeadless : Boolean(headless);
    botLogger.debug('BotOrchestrator initialized with headless setting', { 
      headlessParam: headless, 
      resolvedHeadless: this.headless,
      appSettingsBrowserHeadless: appSettings.browserHeadless
    });
    this.browser_kind = browser ?? (this.cfg as Record<string, unknown>)['BROWSER'] as string ?? 'chromium';
    this.progress_callback = progress_callback;
    this.formConfig = formConfig;
    this.webform_filler = new WebformFiller(this.cfg, this.headless, this.browser_kind, this.formConfig);
    this.login_manager = new LoginManager(this.cfg, this.webform_filler);
  }

  /**
   * Initializes the browser and starts the automation session
   * @returns Promise that resolves when browser is ready
   */
  async start(): Promise<void> { await this.webform_filler.start(); }
  
  /**
   * Closes the browser and cleans up resources
   * @returns Promise that resolves when cleanup is complete
   */
  async close(): Promise<void> { await this.webform_filler.close(); }

  /**
   * Runs the automation workflow for a batch of rows.
   *
   * - `df` is an array of rows, where each row uses column labels as keys
   *   (example: `{ Date: '01/15/2024', Project: 'OSC-BBB', Hours: 8 }`).
   * - The return value uses **indices into `df`**, not external IDs.
   * - The method supports cancellation through `AbortSignal`.
   */
  async run_automation(df: Array<Record<string, unknown>>, creds: [string, string], abortSignal?: AbortSignal): Promise<[boolean, number[], Array<[number,string]>]> {
    const result = await this._run_automation_internal(df, creds, abortSignal);
    return [result.success, result.submitted_indices, result.errors];
  }

  /**
   * Executes the login process with provided credentials
   * @param email - User email for authentication
   * @param password - User password for authentication
   * @returns Promise that resolves when login is complete
   */
  run_login_steps(email: string, password: string): Promise<void> { return this.login_manager.run_login_steps(email, password); }

  /**
   * Gets the current browser page instance
   * @returns Playwright Page object
   * @throws BotNotStartedError if browser is not started
   */
  require_page() { return this.webform_filler.require_page(); }

  /**
   * Waits for an element to become visible and returns its locator
   * @param sel - CSS selector for the element to wait for
   * @returns Promise resolving to Playwright Locator object
   * @throws Error if element doesn't become visible within timeout
   */
  async wait_visible(sel: string) {
    const page = this.webform_filler.require_page();
    const ok = await Cfg.dynamic_wait_for_element(page, sel, 'visible', Cfg.DYNAMIC_WAIT_BASE_TIMEOUT, Cfg.GLOBAL_TIMEOUT, `element visibility (${sel})`);
    if (!ok) throw new Error(`Element '${sel}' did not become visible within timeout`);
    return page.locator(sel);
  }

  /**
   * Clicks an element identified by selector
   * @param sel - CSS selector for the element to click
   */
  async click(sel: string) { const page = this.webform_filler.require_page(); await page.locator(sel).click(); }
  
  /**
   * Types text into an element identified by selector
   * @param sel - CSS selector for the input element
   * @param text - Text to type into the element
   */
  async type(sel: string, text: string) { const page = this.webform_filler.require_page(); await page.locator(sel).type(text); }

  /**
   * Determines if a field should be processed based on its value
   * @private
   * @param field_key - Key identifying the field
   * @param fields - Object containing field values
   * @returns True if field should be processed, false otherwise
   */
  private _should_process_field(field_key: string, fields: Record<string, unknown>): boolean {
    const fieldValue = fields[field_key];
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
   * @param project_name - Name of the project to get tool for
   * @returns CSS selector for project-specific tool input or null if not found
   */
  private get_project_specific_tool_locator(project_name: string): string | null {
    const map = this.cfg.PROJECT_TO_TOOL_LABEL;
    if (project_name && map[project_name]) return `input[aria-label='${map[project_name]}']`;
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
      
      // Support multiple human-entered date formats: mm/dd/yyyy, m/d/yyyy, mm-dd-yyyy, etc.
      // Quarter routing uses `YYYY-MM-DD`, so we convert.
      const dateMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (!dateMatch) {
        return `Invalid date format: ${dateStr}. Expected mm/dd/yyyy`;
      }
      
      const [, monthStr, dayStr, yearStr] = dateMatch;
      if (!monthStr || !dayStr || !yearStr) {
        return `Invalid date format: ${dateStr}. Expected mm/dd/yyyy`;
      }
      
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      const year = parseInt(yearStr, 10);
      
      // Validate date ranges
      if (isNaN(month) || isNaN(day) || isNaN(year) || 
          month < 1 || month > 12 || 
          day < 1 || day > 31 || 
          year < 1900 || year > 2100) {
        return `Invalid date values: ${dateStr}`;
      }
      
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const quarterDef = getQuarterForDate(isoDate);
      
      if (quarterDef && quarterDef.formId !== this.formConfig.FORM_ID) {
        // Protect against “wrong quarter form” submissions: a date in Q3 should not
        // submit to a Q4 form (or vice versa). This check intentionally blocks.
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
    const fields = this._build_fields_from_row(row);
    
    // Validate required fields early to avoid partial UI interactions that can leave
    // the form in an unexpected state.
    if (!this._validate_required_fields(fields, rowIndex)) {
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
    await this.webform_filler.wait_for_form_ready();

    // Fill fields
    botLogger.verbose('Filling form fields', { rowIndex });
    const fillTimer = botLogger.startTimer('row-fill');
    await this._fill_fields(fields);
    fillTimer.done({ rowIndex });

    // Submit is optional: tests and debugging sometimes run in “fill-only” mode.
    if (Cfg.SUBMIT_FORM_AFTER_FILLING) {
      botLogger.verbose('Waiting for form to stabilize before submission', { rowIndex });
      // Wait for form to be stable (no ongoing animations or changes)
      await Cfg.wait_for_dom_stability(
        this.webform_filler.require_page(),
        'form',
        'visible',
        Cfg.SUBMIT_DELAY_AFTER_FILLING,
        Cfg.SUBMIT_DELAY_AFTER_FILLING * 2,
        'form stabilization before submission'
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
    let success = await this.webform_filler.submit_form();
    
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
    success = await this.webform_filler.submit_form();
    
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
      this.webform_filler.require_page(),
      'body',
      'visible',
      level2Delay,
      level2Delay * 2,
      'page stabilization before Level 2 retry'
    );
    
    botLogger.verbose('Re-filling form fields for Level 2 retry', { rowIndex, retryLevel: 'level-2' });
    await this._fill_fields(fields);
    
    botLogger.info('Attempting Level 2 retry submission', { rowIndex, attempt: 3, retryLevel: 'level-2' });
    success = await this.webform_filler.submit_form();
    
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
  private async _run_automation_internal(df: Array<Record<string, unknown>>, creds: [string, string], abortSignal?: AbortSignal): Promise<AutomationResult> {
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
      await this.login_manager.run_login_steps(email, password, 0);
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
          botLogger.error('Row processing encountered error', { rowIndex: idx, error: errorMsg });
          
          failed_rows.push([idx, errorMsg]);
          
          // Attempt to recover by returning to the base form URL. This provides
          // a clean starting point for the next row after transient UI errors.
          try {
            botLogger.info('Attempting recovery', { rowIndex: idx });
            await this.webform_filler.navigate_to_base();
          } catch (recoveryError) {
            botLogger.error('Could not recover from page error', { rowIndex: idx, recoveryError: String(recoveryError) });
          }
        }
      }

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
  private _build_fields_from_row(row: Record<string, unknown>): Record<string, unknown> {
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
  private async _fill_fields(fields: Record<string, unknown>): Promise<void> {
    botLogger.verbose('Processing fields for form filling', { fieldCount: Object.keys(fields).length, fields });
    
    for (const [field_key, value] of Object.entries(fields)) {
      let specBase: Record<string, unknown> | undefined;
      try {
        botLogger.debug('Processing field', { fieldKey: field_key, value });
        
        specBase = Cfg.FIELD_DEFINITIONS[field_key] as unknown as Record<string, unknown>;
        if (!specBase) {
          botLogger.debug('Skipping field', { fieldKey: field_key, reason: 'No specification found' });
          continue;
        }
        
        // Skip empty values
        if (!this._should_process_field(field_key, fields)) {
          botLogger.debug('Skipping field', { fieldKey: field_key, reason: 'Empty/invalid value', value: String(value) });
          continue;
        }
        
        // Check if project needs tool/detail code fields
        if (field_key === 'tool' || field_key === 'detail_code') {
          const project_name = String(fields['project_code'] ?? 'Unknown');
          if (!this._should_process_field(field_key, fields)) {
            botLogger.debug('Skipping field', { fieldKey: field_key, reason: 'Not required for project', projectName: project_name });
            continue;
          }
        }
        
        const spec = { ...specBase };
        
        // Use project-specific locator for tool field if available
        if (field_key === 'tool') {
          const project_name = String(fields['project_code'] ?? 'Unknown');
          const project_specific_locator = this.get_project_specific_tool_locator(project_name);
          if (project_specific_locator) {
            spec['locator'] = project_specific_locator;
            botLogger.debug('Using project-specific locator', { 
              fieldKey: field_key, 
              projectName: project_name, 
              locator: project_specific_locator 
            });
          }
        }
        
        // Log field specification details
        botLogger.debug('Field specification', { 
          fieldKey: field_key,
          label: spec['label'] || 'No label',
          type: spec['type'] || 'text',
          locator: spec['locator'] || 'No locator'
        });
        
        // Inject the field value
        botLogger.debug('Injecting field value', { fieldKey: field_key, value: String(value) });
        await this.webform_filler.inject_field_value(spec, String(value));
        
      } catch (error) {
        botLogger.error('Could not process field', { 
          fieldKey: field_key, 
          value, 
          fieldSpec: specBase ? JSON.stringify(specBase) : 'Not available',
          error: String(error) 
        });
        throw error;
      }
    }
  }

  /**
   * Validates that all required fields are present and have valid values
   * @private
   * @param fields - Object containing field values to validate
   * @param _idx - Row index (unused but kept for interface consistency)
   * @returns True if all required fields are valid, false otherwise
   */
  private _validate_required_fields(fields: Record<string, unknown>, _idx: number): boolean {
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
