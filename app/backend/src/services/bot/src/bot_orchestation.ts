/**
 * @fileoverview Bot Orchestrator - Main automation controller for timesheet form filling
 * 
 * This module provides the primary interface for automating timesheet submissions.
 * It coordinates between authentication, web form filling, and submission processes.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import * as Cfg from './automation_config';
import { WebformFiller } from './webform_flow';
import { LoginManager } from './authentication_flow';
import { botLogger } from '../../../../../shared/logger';
import { getQuarterForDate } from './quarter_config';

/**
 * Utility function to chunk an array into smaller arrays of specified size
 * @param rows - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunked arrays
 */
function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

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
 * Main orchestrator class for timesheet automation
 * 
 * Coordinates the entire automation process including browser management,
 * authentication, form filling, and submission. Provides a high-level
 * interface for automating timesheet data entry.
 */
export class BotOrchestrator {
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
   * @param headless - Whether to run browser in headless mode (default: true)
   * @param browser - Browser type to use (must be 'chromium')
   * @param progress_callback - Optional callback for progress updates
   */
  constructor(
    injected_config: typeof Cfg,
    formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] },
    headless: boolean | null = true,
    browser: string | null = null,
    progress_callback?: (pct: number, msg: string) => void
  ) {
    if (!formConfig) {
      throw new Error('formConfig is required. Use createFormConfig() to create a valid form configuration.');
    }
    this.cfg = injected_config;
    this.headless = headless === null ? Cfg.BROWSER_HEADLESS : Boolean(headless);
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
   * Executes the main automation process for timesheet data
   * 
   * Processes an array of data rows, authenticates, fills forms, and submits entries.
   * Each row should be a map of column labels to values (similar to pandas DataFrame rows).
   * 
   * @param df - Array of data rows, each containing column label -> value mappings
   * @param creds - Tuple containing [email, password] for authentication
   * @returns Promise resolving to [success, submitted_indices, errors] tuple
   */
  async run_automation(df: Array<Record<string, unknown>>, creds: [string, string]): Promise<[boolean, number[], Array<[number,string]>]> {
    const result = await this._run_automation_internal(df, creds);
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
    
    // Skip if field is empty string or 'nan'/'none' string
    const stringValue = String(fieldValue).toLowerCase();
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
   * Processes a single row in a specific browser context
   * @private
   * @param row - Data row to process
   * @param rowIndex - Index of the row in the original array
   * @param contextIndex - Browser context index to use
   * @param creds - Authentication credentials [email, password]
   * @returns Promise resolving to row index on success
   * @throws Error if row processing fails
   */
  private async _process_single_row(
    row: Record<string, unknown>,
    rowIndex: number,
    contextIndex: number,
    creds: [string, string]
  ): Promise<number> {
    const [email, password] = creds;
    const status_col = ((this.cfg as Record<string, unknown>)['STATUS_COLUMN_NAME'] as string) ?? 'Status';
    const complete_val = (this.cfg as Record<string, unknown>)['STATUS_COMPLETE'] ?? 'Complete';
    
    try {
      botLogger.verbose('Processing row in context', { rowIndex, contextIndex });
      
      // Skip completed rows
      if (status_col in row && String(row[status_col as string] ?? '').trim() === complete_val) {
        botLogger.verbose('Skipping completed row', { rowIndex, contextIndex });
        throw new Error('Row already complete');
      }
      
      // Build fields from row
      const fields = this._build_fields_from_row(row);
      
      // Validate required fields
      if (!this._validate_required_fields(fields, rowIndex)) {
        botLogger.warn('Row skipped', { rowIndex, contextIndex, reason: 'Missing required fields' });
        throw new Error('Missing required fields');
      }
      
      // Validate quarter
      if (fields['date']) {
        const dateStr = String(fields['date']);
        const [month, day, year] = dateStr.split('/');
        if (month && day && year) {
          const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          const quarterDef = getQuarterForDate(isoDate);
          
          if (quarterDef && quarterDef.formId !== this.formConfig.FORM_ID) {
            botLogger.error('Quarter mismatch detected', { 
              rowIndex,
              contextIndex,
              entryDate: fields['date'],
              entryQuarter: quarterDef.id,
              configuredFormId: this.formConfig.FORM_ID,
              expectedFormId: quarterDef.formId
            });
            throw new Error(`Date ${fields['date']} belongs to ${quarterDef.name} but form configured for different quarter`);
          }
        }
      }
      
      // Ensure logged in for this context
      await this.login_manager.run_login_steps(email, password, contextIndex);
      
      // Ensure page stability
      await this.webform_filler.wait_for_form_ready(contextIndex);
      
      // Fill fields
      botLogger.verbose('Filling form fields', { rowIndex, contextIndex });
      await this._fill_fields_for_context(contextIndex, fields);
      
      // Submit form
      if (Cfg.SUBMIT_FORM_AFTER_FILLING) {
        botLogger.verbose('Waiting for form to stabilize before submission', { rowIndex, contextIndex });
        const page = this.webform_filler.getPage(contextIndex);
        await Cfg.wait_for_dom_stability(
          page,
          'form',
          'visible',
          Cfg.SUBMIT_DELAY_AFTER_FILLING,
          Cfg.SUBMIT_DELAY_AFTER_FILLING * 2,
          'form stabilization before submission'
        );
        
        // Retry form submission with HTTP 200 validation
        const maxRetries = this.cfg.SUBMIT_RETRY_ATTEMPTS;
        let submissionSuccess = false;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          botLogger.info('Submitting form', { rowIndex, contextIndex, attempt: attempt + 1, maxRetries });
          const success = await this.webform_filler.submit_form(contextIndex);
          
          if (success) {
            botLogger.info('Row submitted successfully', { rowIndex, contextIndex, httpStatus: 200 });
            submissionSuccess = true;
            break;
          } else {
            botLogger.warn('Submission attempt unsuccessful', { rowIndex, contextIndex, attempt: attempt + 1, reason: 'No HTTP 200 response' });
            if (attempt < maxRetries - 1) {
              const retryDelay = Cfg.SUBMIT_RETRY_DELAY;
              botLogger.verbose('Waiting for page to stabilize before retry', { rowIndex, contextIndex, retryDelay });
              await Cfg.wait_for_dom_stability(
                page,
                'body',
                'visible',
                retryDelay,
                retryDelay * 2,
                'page stabilization before retry'
              );
              
              // Re-fill the form before retry
              botLogger.verbose('Re-filling form fields for retry attempt', { rowIndex, contextIndex });
              await this._fill_fields_for_context(contextIndex, fields);
            }
          }
        }
        
        if (!submissionSuccess) {
          botLogger.error('Row processing failed after retries', { rowIndex, contextIndex, maxRetries, reason: 'No HTTP 200 response' });
          throw new Error(`Form submission failed after ${maxRetries} attempts`);
        }
      }
      
      botLogger.info('Row completed successfully', { rowIndex, contextIndex });
      return rowIndex;
      
    } catch (error) {
      const errorMsg = String((error as Error)?.message ?? error);
      botLogger.error('Row processing encountered error', { rowIndex, contextIndex, error: errorMsg });
      
      // Attempt recovery
      try {
        botLogger.info('Attempting recovery', { rowIndex, contextIndex });
        await this.webform_filler.navigate_to_base(contextIndex);
      } catch (recoveryError) {
        botLogger.error('Could not recover from page error', { rowIndex, contextIndex, recoveryError: String(recoveryError) });
      }
      
      throw error;
    }
  }
  
  /**
   * Fills form fields for a specific context
   * @private
   * @param contextIndex - Browser context index
   * @param fields - Fields to fill
   */
  private async _fill_fields_for_context(contextIndex: number, fields: Record<string, unknown>): Promise<void> {
    botLogger.verbose('Processing fields for form filling', { contextIndex, fieldCount: Object.keys(fields).length, fields });
    
    for (const [field_key, value] of Object.entries(fields)) {
      let specBase: Record<string, unknown> | undefined;
      try {
        botLogger.debug('Processing field', { contextIndex, fieldKey: field_key, value });
        
        specBase = Cfg.FIELD_DEFINITIONS[field_key] as unknown as Record<string, unknown>;
        if (!specBase) {
          botLogger.debug('Skipping field', { contextIndex, fieldKey: field_key, reason: 'No specification found' });
          continue;
        }
        
        // Skip empty values
        if (!this._should_process_field(field_key, fields)) {
          botLogger.debug('Skipping field', { contextIndex, fieldKey: field_key, reason: 'Empty/invalid value', value: String(value) });
          continue;
        }
        
        // Check if project needs tool/detail code fields
        if (field_key === 'tool' || field_key === 'detail_code') {
          const project_name = String(fields['project_code'] ?? 'Unknown');
          if (!this._should_process_field(field_key, fields)) {
            botLogger.debug('Skipping field', { contextIndex, fieldKey: field_key, reason: 'Not required for project', projectName: project_name });
            continue;
          }
        }
        
        let spec = { ...specBase };
        
        // Use project-specific locator for tool field if available
        if (field_key === 'tool') {
          const project_name = String(fields['project_code'] ?? 'Unknown');
          const project_specific_locator = this.get_project_specific_tool_locator(project_name);
          if (project_specific_locator) {
            spec['locator'] = project_specific_locator;
            botLogger.debug('Using project-specific locator', { 
              contextIndex,
              fieldKey: field_key, 
              projectName: project_name, 
              locator: project_specific_locator 
            });
          }
        }
        
        // Log field specification details
        botLogger.debug('Field specification', { 
          contextIndex,
          fieldKey: field_key,
          label: spec['label'] || 'No label',
          type: spec['type'] || 'text',
          locator: spec['locator'] || 'No locator'
        });
        
        // Inject the field value
        botLogger.debug('Injecting field value', { contextIndex, fieldKey: field_key, value: String(value) });
        await this.webform_filler.inject_field_value(spec, String(value), contextIndex);
        
        // CONDITIONAL FIELD HANDLING: Wait for dependent fields to appear after filling their prerequisites
        const page = this.webform_filler.getPage(contextIndex);
        
        // After filling Project, wait for Tool field to appear (if Tool field will be filled)
        if (field_key === 'project_code' && fields['tool']) {
          const toolSpec = Cfg.FIELD_DEFINITIONS['tool'] as unknown as Record<string, unknown>;
          if (toolSpec && toolSpec['locator']) {
            const toolLocator = String(toolSpec['locator']);
            botLogger.verbose('Waiting for Tool field to appear after Project selection', { contextIndex });
            const toolAppeared = await Cfg.dynamic_wait_for_element(
              page,
              toolLocator,
              'visible',
              0.2,  // base: 200ms
              2.0,  // max: 2s
              'Tool field appearance'
            );
            if (toolAppeared) {
              botLogger.verbose('Tool field appeared', { contextIndex });
            } else {
              botLogger.warn('Tool field did not appear within timeout', { contextIndex, timeout: '2s' });
            }
          }
        }
        
        // After filling Tool, wait for Detail Charge Code field to appear (if Detail Charge Code will be filled)
        if (field_key === 'tool' && fields['detail_code']) {
          const detailCodeSpec = Cfg.FIELD_DEFINITIONS['detail_code'] as unknown as Record<string, unknown>;
          if (detailCodeSpec && detailCodeSpec['locator']) {
            const detailCodeLocator = String(detailCodeSpec['locator']);
            botLogger.verbose('Waiting for Detail Charge Code field to appear after Tool selection', { contextIndex });
            const detailCodeAppeared = await Cfg.dynamic_wait_for_element(
              page,
              detailCodeLocator,
              'visible',
              0.2,  // base: 200ms
              2.0,  // max: 2s
              'Detail Charge Code field appearance'
            );
            if (detailCodeAppeared) {
              botLogger.verbose('Detail Charge Code field appeared', { contextIndex });
            } else {
              botLogger.warn('Detail Charge Code field did not appear within timeout', { contextIndex, timeout: '2s' });
            }
          }
        }
        
      } catch (error) {
        botLogger.error('Could not process field', { 
          contextIndex,
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
   * Internal method that executes the core automation logic
   * @private
   * @param df - Array of data rows to process
   * @param creds - Authentication credentials [email, password]
   * @returns Promise resolving to detailed automation results
   */
  private async _run_automation_internal(df: Array<Record<string, unknown>>, creds: [string, string]): Promise<AutomationResult> {
    const [email, password] = creds;
    const submitted: number[] = [];
    const failed_rows: Array<[number, string]> = [];
    const total_rows = df.length;

    try {
      const parallelEnabled = Cfg.ENABLE_PARALLEL_PROCESSING;
      const maxParallel = parallelEnabled ? Cfg.MAX_PARALLEL_CONTEXTS : 1;
      
      botLogger.info('Starting automation workflow', { 
        totalRows: total_rows, 
        email,
        parallelProcessing: parallelEnabled,
        maxParallelContexts: maxParallel
      });
      
      // Login to first context
      botLogger.info('Logging in to primary context', { progress: 10 });
      this.progress_callback?.(10, 'Logging in');
      await this.login_manager.run_login_steps(email, password, 0);
      
      botLogger.info('Login complete', { progress: 20 });
      this.progress_callback?.(20, 'Login complete');

      const status_col = ((this.cfg as Record<string, unknown>)['STATUS_COLUMN_NAME'] as string) ?? 'Status';
      const complete_val = (this.cfg as Record<string, unknown>)['STATUS_COMPLETE'] ?? 'Complete';
      botLogger.info('Processing rows', { 
        totalRows: total_rows, 
        statusColumn: status_col, 
        completeValue: complete_val,
        mode: parallelEnabled ? 'parallel' : 'sequential'
      });

      if (parallelEnabled && maxParallel > 1) {
        // PARALLEL PROCESSING MODE
        botLogger.info('Using parallel processing', { maxParallel });
        
        // Create batches for parallel processing
        const rowBatches = chunkRows(df, maxParallel);
        let processedCount = 0;
        
        for (let batchIndex = 0; batchIndex < rowBatches.length; batchIndex++) {
          const batch = rowBatches[batchIndex];
          if (!batch) continue;
          
          botLogger.info('Processing batch', { 
            batchIndex: batchIndex + 1, 
            totalBatches: rowBatches.length,
            batchSize: batch.length
          });
          
          // Process batch in parallel using Promise.allSettled
          const batchPromises = batch.map((row, batchOffset) => {
            const globalRowIndex = batchIndex * maxParallel + batchOffset;
            const contextIndex = batchOffset % maxParallel;
            
            return this._process_single_row(row, globalRowIndex, contextIndex, creds);
          });
          
          const results = await Promise.allSettled(batchPromises);
          
          // Collect results
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (!result) continue;
            
            const globalRowIndex = batchIndex * maxParallel + i;
            
            if (result.status === 'fulfilled') {
              submitted.push(result.value);
              botLogger.info('Batch row succeeded', { globalRowIndex, batchIndex, rowIndexInBatch: i });
            } else if (result.status === 'rejected') {
              const errorMsg = String(result.reason?.message ?? result.reason);
              failed_rows.push([globalRowIndex, errorMsg]);
              botLogger.warn('Batch row failed', { globalRowIndex, batchIndex, rowIndexInBatch: i, error: errorMsg });
            }
          }
          
          processedCount += batch.length;
          const progress = 20 + Math.floor(60 * processedCount / total_rows);
          this.progress_callback?.(progress, `Processed ${processedCount}/${total_rows} rows`);
        }
        
      } else {
        // SEQUENTIAL PROCESSING MODE (legacy/fallback)
        botLogger.info('Using sequential processing');
        
        for (let i = 0; i < df.length; i++) {
          const idx = i; // Using array index as row identifier
          const row = df[i];
          if (!row) continue;
        try {
          // Skip completed rows
          if (status_col in row && String(row[status_col as string] ?? '').trim() === complete_val) {
            const progress = 20 + Math.floor(60 * (i+1) / total_rows);
            botLogger.verbose('Skipping completed row', { rowIndex: i+1, totalRows: total_rows, progress });
            this.progress_callback?.(progress, `Skipping completed row ${i+1}`);
            continue;
          }

          const progress = 20 + Math.floor(60 * (i+1) / total_rows);
          botLogger.verbose('Processing row', { rowIndex: i+1, totalRows: total_rows, progress });

          // Build fields from row
          const fields = this._build_fields_from_row(row);
          
          // Validate required fields
          if (!this._validate_required_fields(fields, idx)) {
            botLogger.warn('Row skipped', { rowIndex: idx, reason: 'Missing required fields' });
            failed_rows.push([idx, 'Missing required fields']);
            continue;
          }

          // Validate that entry date matches the quarter of the configured form
          if (fields['date']) {
            // Convert date from mm/dd/yyyy to yyyy-mm-dd for quarter validation
            const dateStr = String(fields['date']);
            const [month, day, year] = dateStr.split('/');
            // Pad month and day to ensure proper formatting
            if (month && day && year) {
              const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              const quarterDef = getQuarterForDate(isoDate);
              
              if (quarterDef && quarterDef.formId !== this.formConfig.FORM_ID) {
                botLogger.error('Quarter mismatch detected', { 
                  rowIndex: idx, 
                  entryDate: fields['date'],
                  entryQuarter: quarterDef.id,
                  configuredFormId: this.formConfig.FORM_ID,
                  expectedFormId: quarterDef.formId
                });
                failed_rows.push([idx, `Date ${fields['date']} belongs to ${quarterDef.name} but form configured for different quarter`]);
                continue;
              }
            }
          }

          // Ensure page stability using webform_filler
          await this.webform_filler.wait_for_form_ready();

          // Fill fields
          botLogger.verbose('Filling form fields', { rowIndex: idx });
          await this._fill_fields(fields);

          if (Cfg.SUBMIT_FORM_AFTER_FILLING) {
            botLogger.verbose('Waiting for form to stabilize before submission', { rowIndex: idx });
            // Wait for form to be stable (no ongoing animations or changes)
            await Cfg.wait_for_dom_stability(
              this.webform_filler.require_page(),
              'form',
              'visible',
              Cfg.SUBMIT_DELAY_AFTER_FILLING,
              Cfg.SUBMIT_DELAY_AFTER_FILLING * 2,
              'form stabilization before submission'
            );
            
            // Retry form submission with HTTP 200 validation
            const maxRetries = this.cfg.SUBMIT_RETRY_ATTEMPTS;
            let submissionSuccess = false;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
              botLogger.info('Submitting form', { rowIndex: idx, attempt: attempt + 1, maxRetries });
              const success = await this.webform_filler.submit_form();
              
              if (success) {
                botLogger.info('Row submitted successfully', { rowIndex: idx, httpStatus: 200 });
                submissionSuccess = true;
                break;
              } else {
                botLogger.warn('Submission attempt unsuccessful', { rowIndex: idx, attempt: attempt + 1, reason: 'No HTTP 200 response' });
                if (attempt < maxRetries - 1) {
                  const retryDelay = Cfg.SUBMIT_RETRY_DELAY;
                  botLogger.verbose('Waiting for page to stabilize before retry', { rowIndex: idx, retryDelay });
                  // Wait for page to be stable before retry
                  await Cfg.wait_for_dom_stability(
                    this.webform_filler.require_page(),
                    'body',
                    'visible',
                    retryDelay,
                    retryDelay * 2,
                    'page stabilization before retry'
                  );
                  
                  // Re-fill the form before retry
                  botLogger.verbose('Re-filling form fields for retry attempt', { rowIndex: idx });
                  await this._fill_fields(fields);
                }
              }
            }
            
            if (!submissionSuccess) {
              botLogger.error('Row processing failed after retries', { rowIndex: idx, maxRetries, reason: 'No HTTP 200 response' });
              failed_rows.push([idx, `Form submission failed after ${maxRetries} attempts`]);
              continue;
            }
          }

          submitted.push(idx);
          botLogger.info('Row completed successfully', { rowIndex: idx });
          
          this.progress_callback?.(20 + Math.floor(60 * (i+1) / total_rows), `Completed row ${i+1}`);
        } catch (e: unknown) {
          const errorMsg = String((e as Error)?.message ?? e);
          botLogger.error('Row processing encountered error', { rowIndex: idx, error: errorMsg });
          
          failed_rows.push([idx, errorMsg]);
          
          // Attempt recovery using webform_filler
          try {
            botLogger.info('Attempting recovery', { rowIndex: idx });
            await this.webform_filler.navigate_to_base();
          } catch (recoveryError) {
            botLogger.error('Could not recover from page error', { rowIndex: idx, recoveryError: String(recoveryError) });
          }
        }
        }  // End of sequential for loop
      }  // End of else block (sequential processing mode)

      // Log final results (applies to both parallel and sequential modes)
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
        
        let spec = { ...specBase };
        
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