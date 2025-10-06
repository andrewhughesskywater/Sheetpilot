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

/**
 * Simple interface function for running timesheet automation
 * 
 * @param rows - Array of timesheet rows to submit
 * @param email - Email for authentication
 * @param password - Password for authentication
 * @returns Promise with automation results
 */
export async function runTimesheet(
  rows: Array<Record<string, any>>, 
  email: string, 
  password: string
): Promise<{
  ok: boolean;
  submitted: number[];
  errors: Array<[number, string]>;
}> {
  const bot = new BotOrchestrator(Cfg, false); // Set headless to false to show browser
  
  try {
    // Initialize the browser before running automation
    await bot.start();
    
    const [success, submitted_indices, errors] = await bot.run_automation(rows, [email, password]);
    
    return {
      ok: success,
      submitted: submitted_indices,
      errors: errors
    };
  } catch (error) {
    return {
      ok: false,
      submitted: [],
      errors: [[-1, error instanceof Error ? error.message : 'Unknown error']]
    };
  } finally {
    // Always clean up the browser, even if automation fails
    try {
      await bot.close();
    } catch (closeError) {
      // Log but don't throw - we don't want cleanup errors to mask the real error
      console.error('Error closing bot browser:', closeError);
    }
  }
}