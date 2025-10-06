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
  /** Type of browser to use (chromium, firefox, webkit) */
  browser_kind: string;
  /** Webform filler instance for form interaction */
  webform_filler: WebformFiller;
  /** Login manager instance for authentication */
  login_manager: LoginManager;
  /** Optional callback for progress updates during automation */
  progress_callback: ((pct: number, msg: string) => void) | undefined;

  /**
   * Creates a new BotOrchestrator instance
   * @param injected_config - Configuration object for automation settings
   * @param headless - Whether to run browser in headless mode (default: true)
   * @param browser - Browser type to use (default: 'chromium')
   * @param progress_callback - Optional callback for progress updates
   */
  constructor(
    injected_config: typeof Cfg,
    headless: boolean | null = true,
    browser: string | null = null,
    progress_callback?: (pct: number, msg: string) => void,
  ) {
    this.cfg = injected_config;
    this.headless = headless === null ? Cfg.BROWSER_HEADLESS : Boolean(headless);
    this.browser_kind = browser ?? (this.cfg as any).BROWSER ?? 'chromium';
    this.progress_callback = progress_callback;
    this.webform_filler = new WebformFiller(this.cfg, this.headless, this.browser_kind);
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
  async run_automation(df: Array<Record<string, any>>, creds: [string, string]): Promise<[boolean, number[], Array<[number,string]>]> {
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
  private _should_process_field(field_key: string, fields: Record<string, any>): boolean {
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
    const map = Cfg.PROJECT_TO_TOOL_LABEL;
    if (project_name && map[project_name]) return `input[aria-label='${map[project_name]}']`;
    return null;
  }

  /**
   * Internal method that executes the core automation logic
   * @private
   * @param df - Array of data rows to process
   * @param creds - Authentication credentials [email, password]
   * @returns Promise resolving to detailed automation results
   */
  private async _run_automation_internal(df: Array<Record<string, any>>, creds: [string, string]): Promise<AutomationResult> {
    const [email, password] = creds;
    const submitted: number[] = [];
    const failed_rows: Array<[number, string]> = [];
    const total_rows = df.length;

    try {
      console.log(`Starting automation workflow for ${total_rows} rows`);
      console.log(`Login credentials provided for user: ${email}`);
      
      // Login
      console.log('Status: Logging in... (10%)');
      this.progress_callback?.(10, 'Logging in');
      await this.login_manager.run_login_steps(email, password);
      
      console.log('Status: Login complete (20%)');
      this.progress_callback?.(20, 'Login complete');

      const status_col = (this.cfg as any).STATUS_COLUMN_NAME ?? 'Status';
      const complete_val = (this.cfg as any).STATUS_COMPLETE ?? 'Complete';
      console.log(`Processing ${total_rows} rows with status column: ${status_col}`);

      for (let i = 0; i < df.length; i++) {
        const idx = i; // Using array index as row identifier
        const row = df[i];
        if (!row) continue;
        try {
          // Skip completed rows
          if (status_col in row && String(row[status_col] ?? '').trim() === complete_val) {
            console.log(`Status: Skipping completed row ${i+1}/${total_rows} (${20 + Math.floor(60 * (i+1) / total_rows)}%)`);
            this.progress_callback?.(20 + Math.floor(60 * (i+1) / total_rows), `Skipping completed row ${i+1}`);
            continue;
          }

          console.log(`Status: Processing row ${i+1}/${total_rows} (${20 + Math.floor(60 * (i+1) / total_rows)}%)`);

          // Build fields from row
          const fields = this._build_fields_from_row(row);
          
          // Validate required fields
          if (!this._validate_required_fields(fields, idx)) {
            console.log(`Row ${idx} skipped: Missing required fields`);
            failed_rows.push([idx, 'Missing required fields']);
            continue;
          }

          // Ensure page stability using webform_filler
          await this.webform_filler.wait_for_form_ready();

          // Fill fields
          console.log(`Filling form fields for row ${idx}`);
          await this._fill_fields(fields);

          if (Cfg.SUBMIT_FORM_AFTER_FILLING) {
            console.log(`Waiting for form to stabilize before submission`);
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
            const maxRetries = Cfg.SUBMIT_RETRY_ATTEMPTS;
            let submissionSuccess = false;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
              console.log(`Submitting form for row ${idx} (attempt ${attempt + 1}/${maxRetries})`);
              const success = await this.webform_filler.submit_form();
              
              if (success) {
                console.log(`Row ${idx} submitted successfully with HTTP 200 response`);
                submissionSuccess = true;
                break;
              } else {
                console.log(`Row ${idx} submission attempt ${attempt + 1} failed: No HTTP 200 response`);
                if (attempt < maxRetries - 1) {
                  const retryDelay = Cfg.SUBMIT_RETRY_DELAY;
                  console.log(`Waiting for page to stabilize before retry...`);
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
                  console.log(`Re-filling form fields for retry attempt`);
                  await this._fill_fields(fields);
                }
              }
            }
            
            if (!submissionSuccess) {
              console.log(`Row ${idx} failed after ${maxRetries} attempts: No HTTP 200 response`);
              failed_rows.push([idx, `Form submission failed after ${maxRetries} attempts`]);
              continue;
            }
          }

          submitted.push(idx);
          console.log(`Row ${idx} completed successfully`);
          
          this.progress_callback?.(20 + Math.floor(60 * (i+1) / total_rows), `Completed row ${i+1}`);
        } catch (e: any) {
          const errorMsg = String(e?.message ?? e);
          console.log(`Row ${idx} processing failed: ${errorMsg}`);
          
          failed_rows.push([idx, errorMsg]);
          
          // Attempt recovery using webform_filler
          try {
            console.log(`Attempting recovery for row ${idx}`);
            await this.webform_filler.navigate_to_base();
          } catch (recoveryError) {
            console.log(`Could not recover from page error on row ${idx}: ${String(recoveryError)}`);
          }
        }
      }

      // Log final results
      const success_count = submitted.length;
      const failure_count = failed_rows.length;
      console.log(`Automation workflow completed:`);
      console.log(`   Total rows: ${total_rows}`);
      console.log(`   Successful: ${success_count}`);
      console.log(`   Failed: ${failure_count}`);
      console.log(`   Success rate: ${total_rows > 0 ? (success_count/total_rows*100).toFixed(1) : 'N/A'}%`);

      return {
        success: submitted.length > 0,
        submitted_indices: submitted,
        errors: failed_rows,
        total_rows,
        success_count: submitted.length,
        failure_count: failed_rows.length,
      };
    } catch (e: any) {
      return {
        success: false,
        submitted_indices: [],
        errors: [[-1, `Automation failed: ${String(e?.message ?? e)}`]],
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
  private _build_fields_from_row(row: Record<string, any>): Record<string, any> {
    const fields: Record<string, any> = {};
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
  private async _fill_fields(fields: Record<string, any>): Promise<void> {
    console.log(`Processing ${Object.keys(fields).length} fields for form filling`);
    
    // Log all available field data for context
    console.log('Available field data:');
    for (const [fieldKey, value] of Object.entries(fields)) {
      console.log(`   ${fieldKey}: '${String(value)}'`);
    }
    
    for (const [field_key, value] of Object.entries(fields)) {
      let specBase: Record<string, any> | undefined;
      try {
        console.log(`Processing field: '${field_key}'`);
        
        specBase = Cfg.FIELD_DEFINITIONS[field_key];
        if (!specBase) {
          console.log(`Skipping field '${field_key}': No specification found`);
          continue;
        }
        
        // Skip empty values
        if (!this._should_process_field(field_key, fields)) {
          console.log(`Skipping field '${field_key}': Empty/invalid value ('${String(value)}')`);
          continue;
        }
        
        // Check if project needs tool/detail code fields
        if (field_key === 'tool' || field_key === 'detail_code') {
          const project_name = String(fields['project_code'] ?? 'Unknown');
          if (!this._should_process_field(field_key, fields)) {
            console.log(`Skipping field '${field_key}': Not required for project '${project_name}'`);
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
            console.log(`Using project-specific locator for '${field_key}' in project '${project_name}': ${project_specific_locator}`);
          }
        }
        
        // Log field specification details
        console.log(`Field specification for '${field_key}':`);
        console.log(`   Label: ${spec['label'] || 'No label'}`);
        console.log(`   Type: ${spec['type'] || 'text'}`);
        console.log(`   Locator: ${spec['locator'] || 'No locator'}`);
        
        // Inject the field value
        console.log(`Calling webform_filler.inject_field_value for '${field_key}'`);
        await this.webform_filler.inject_field_value(spec, String(value));
        
      } catch (error) {
        console.error(`Failed to process field '${field_key}' with value '${value}'`);
        console.error(`   Field specification: ${specBase ? JSON.stringify(specBase) : 'Not available'}`);
        console.error(`   Error: ${String(error)}`);
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
  private _validate_required_fields(fields: Record<string, any>, _idx: number): boolean {
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