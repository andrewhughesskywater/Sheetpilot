/**
 * @fileoverview Main entry point for the timesheet automation bot
 * 
 * This module re-exports all public classes, types, and utilities
 * from the automation system components for easy importing.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

// Core automation classes
export { BotOrchestrator, TimesheetBot, type AutomationResult } from './bot_orchestation';
import { BotOrchestrator } from './bot_orchestation';
import * as Cfg from './automation_config';
import { appSettings } from '../../../../../shared/constants';
import { botLogger } from '../../../../../shared/logger';

// Authentication and login management
export { LoginManager, BotNavigationError } from './authentication_flow';

// Browser automation and form interaction
export { WebformFiller, BotNotStartedError } from './webform_flow';

// Configuration constants and utilities
export * from './automation_config';

// Quarter configuration and routing
export * from './quarter_config';

/**
 * Simple interface function for running timesheet automation
 * 
 * @param rows - Array of timesheet rows to submit
 * @param email - Email for authentication
 * @param password - Password for authentication
 * @param formConfig - Form configuration for dynamic form URLs/IDs (required)
 * @param progressCallback - Optional callback for progress updates
 * @param headless - Whether to run browser in headless mode (default: read from environment variable)
 * @param abortSignal - Optional abort signal for cancellation support
 * @returns Promise with automation results
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
  // Read headless setting from shared settings object if not explicitly provided
  // appSettings.browserHeadless updates dynamically when changed via Settings UI
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
      // Check for Electron browser closure errors
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