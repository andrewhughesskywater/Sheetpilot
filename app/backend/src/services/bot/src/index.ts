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
 * @returns Promise with automation results
 */
export async function runTimesheet(
  rows: Array<Record<string, unknown>>, 
  email: string, 
  password: string,
  formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] }
): Promise<{
  ok: boolean;
  submitted: number[];
  errors: Array<[number, string]>;
}> {
  const bot = new BotOrchestrator(Cfg, formConfig, false, null, undefined); // Set headless to false to show browser
  
  try {
    // Handle empty rows array - should succeed immediately
    if (rows.length === 0) {
      console.log('[Bot] No rows to process, returning success');
      return {
        ok: true,
        submitted: [],
        errors: []
      };
    }
    
    // Initialize the browser before running automation
    console.log('[Bot] Starting browser initialization...');
    await bot.start();
    console.log('[Bot] Browser started successfully');
    
    console.log('[Bot] Starting automation with', rows.length, 'rows');
    const [success, submitted_indices, errors] = await bot.run_automation(rows, [email, password]);
    console.log('[Bot] Automation completed:', { success, submittedCount: submitted_indices.length, errorCount: errors.length });
    
    return {
      ok: success,
      submitted: submitted_indices,
      errors: errors
    };
  } catch (error) {
    console.error('[Bot] Error during automation:', error);
    // Re-throw the error so it can be properly handled by the calling code
    throw error;
  } finally {
    // Always clean up the browser, even if automation fails
    try {
      console.log('[Bot] Closing browser...');
      await bot.close();
      console.log('[Bot] Browser closed successfully');
    } catch (closeError) {
      // Log but don't throw - we don't want cleanup errors to mask the real error
      console.error('Error closing bot browser:', closeError);
    }
  }
}