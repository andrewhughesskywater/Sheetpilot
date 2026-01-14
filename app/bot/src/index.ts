/**
 * Main entry point for @sheetpilot/bot
 * 
 * Re-exports the bot API from the scripts/core module
 */

export * from './scripts/core/index';

// Export utilities
export { checkAborted, createCancelledResult, setupAbortHandler } from './scripts/utils/abort-utils';
export { processEntriesByQuarter } from './scripts/utils/quarter-processing';

// Export config utilities
export { validateQuarterAvailability, QUARTER_DEFINITIONS, getQuarterForDate, groupEntriesByQuarter, type QuarterDefinition } from './engine/config/quarter_config';
export * from './engine/config/automation_config';

// Export internal modules for testing (use with caution)
export * from './scripts/core/bot_orchestation';
export { LoginManager, type BrowserManager } from './scripts/utils/authentication_flow';
export * from './engine/browser/browser_launcher';
export * from './engine/browser/webform_session';
export * from './engine/browser/form_interactor';
export * from './engine/browser/submission_monitor';