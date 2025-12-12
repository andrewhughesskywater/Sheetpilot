/**
 * Public API for the Sheetpilot timesheet automation bot.
 *
 * ## How to navigate this package
 * - **Orchestration**: `BotOrchestrator` coordinates the full workflow (login → fill → submit).
 * - **Browser automation**: `WebformFiller` owns Playwright lifecycle and page interactions.
 * - **Authentication**: `LoginManager` executes `LOGIN_STEPS` (config-driven login recipe).
 * - **Configuration**: `automation_config.ts` provides selectors, timeouts, and behavior flags.
 * - **Quarter routing**: `quarter_config.ts` maps dates to the correct Smartsheet form.
 *
 * ## Common call path (simplified)
 *
 * ```mermaid
 * flowchart TD
 *   caller[Caller] --> runTimesheet
 *   runTimesheet --> orchestrator[BotOrchestrator]
 *   orchestrator --> startBrowser[WebformFiller.start]
 *   orchestrator --> login[LoginManager.run_login_steps]
 *   orchestrator --> processRows[ProcessRows]
 *   processRows --> fill[FillFields]
 *   processRows --> submit[SubmitAndVerify]
 *   submit --> monitor[SubmissionMonitor_or_submit_form]
 *   processRows --> cleanup[CloseBrowser]
 * ```
 *
 * ## Compatibility note
 * Some files in `src/` exist only to preserve historic import paths (re-exports).
 * Prefer importing from this module (`src/core/index.ts`) for new code.
 */

// Core automation classes
export { BotOrchestrator, TimesheetBot, type AutomationResult } from './bot_orchestation';
import { BotOrchestrator } from './bot_orchestation';
import * as Cfg from '../automation_config';
import { appSettings } from '@sheetpilot/shared/constants';
import { botLogger } from '@sheetpilot/shared/logger';

// Authentication and login management
export { LoginManager, BotNavigationError } from '../utils/authentication_flow';

// Browser automation and form interaction
export { WebformFiller, BotNotStartedError } from '../webform_flow';

// Configuration constants and utilities
export * from '../automation_config';

// Quarter configuration and routing
export * from '../quarter_config';

/**
 * Runs timesheet automation for a batch of rows.
 *
 * Callers typically create `rows` from timesheet entries. The bot returns
 * **row indices** (0-based, relative to the `rows` array passed in).
 *
 * `formConfig` must match the form you expect to submit to (usually quarter-based).
 */
export async function runTimesheet(
  rows: Array<Record<string, unknown>>, 
  email: string, 
  password: string,
  formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] },
  progressCallback?: (percent: number, message: string) => void,
  headless?: boolean,
  abortSignal?: AbortSignal
): Promise<{
  ok: boolean;
  submitted: number[];
  errors: Array<[number, string]>;
}> {
  // Prefer the explicit parameter, otherwise use the UI-controlled setting.
  // `appSettings.browserHeadless` updates at runtime when a user changes Settings.
  const useHeadless = headless !== undefined ? headless : appSettings.browserHeadless;
  botLogger.info('Initializing bot orchestrator', { 
    headlessParam: headless,
    useHeadless, 
    appSettingsBrowserHeadless: appSettings.browserHeadless,
    hasProgressCallback: !!progressCallback 
  });
  const bot = new BotOrchestrator(Cfg, formConfig, useHeadless, null, progressCallback);
  
  try {
    // Check if aborted before starting
    if (abortSignal?.aborted) {
      botLogger.info('Automation aborted before starting');
      return {
        ok: false,
        submitted: [],
        errors: [[0, 'Automation was cancelled']]
      };
    }
    
    // Handle empty rows array - should succeed immediately
    if (rows.length === 0) {
      botLogger.info('No rows to process, returning success immediately');
      return {
        ok: true,
        submitted: [],
        errors: []
      };
    }
    
    // Initialize the browser before running automation
    botLogger.info('Starting browser initialization', { rowCount: rows.length });
    await bot.start();
    botLogger.info('Browser started successfully');
    
    // Check if aborted after browser start
    if (abortSignal?.aborted) {
      botLogger.info('Automation aborted after browser start');
      return {
        ok: false,
        submitted: [],
        errors: [[0, 'Automation was cancelled']]
      };
    }
    
    botLogger.info('Starting automation', { rowCount: rows.length });
    const [success, submitted_indices, errors] = await bot.run_automation(rows, [email, password], abortSignal);
    botLogger.info('Automation completed', { success, submittedCount: submitted_indices.length, errorCount: errors.length });
    
    return {
      ok: success,
      submitted: submitted_indices,
      errors: errors
    };
  } catch (error) {
    // Check if error is due to abort or browser closure
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('cancelled') || errorMsg.includes('aborted')) {
        botLogger.info('Automation was cancelled');
        return {
          ok: false,
          submitted: [],
          errors: [[0, 'Automation was cancelled']]
        };
      }
      // Check for Playwright browser closure errors
      if (errorMsg.includes('browser has been closed') || errorMsg.includes('target closed')) {
        botLogger.info('Browser was closed during automation');
        return {
          ok: false,
          submitted: [],
          errors: [[0, 'Automation was cancelled - browser closed']]
        };
      }
    }
    
    botLogger.error('Error during automation', { error: error instanceof Error ? error.message : String(error) });
    // Re-throw the error so it can be properly handled by the calling code
    throw error;
  } finally {
    // Always clean up the browser, even if automation fails
    try {
      botLogger.verbose('Closing browser');
      await bot.close();
      botLogger.info('Browser closed successfully');
    } catch (closeError) {
      // Log but don't throw - we don't want cleanup errors to mask the real error
      botLogger.error('Could not close bot browser', { error: closeError instanceof Error ? closeError.message : String(closeError) });
    }
  }
}