/**
 * @fileoverview Application Constants
 *
 * Centralized location for application-wide constants.
 * This ensures a single source of truth for values like version numbers.
 *
 * @author SheetPilot Team
 * @version 1.4.0
 */

/**
 * Lazy logger import to avoid circular dependency with logger.ts
 * @private
 */
function getLogger() {
  // Use dynamic import to avoid circular dependency
  const { appLogger } = require('./logger');
  return appLogger;
}

/**
 * Re-export APP_VERSION for backwards compatibility
 */
export { APP_VERSION } from './version';

/**
 * Application name
 */
export const APP_NAME = 'Sheetpilot';

/**
 * Product name for display purposes
 */
export const PRODUCT_NAME = 'Sheetpilot';

/**
 * Number of previous quarters allowed for date entry
 * 0 = current quarter only
 * 1 = current quarter + previous quarter
 */
export const ALLOWED_PREVIOUS_QUARTERS = 1;

/**
 * Application settings object
 * Properties update everywhere automatically (object reference semantics)
 * Settings are persisted to disk via settings-handlers.ts
 */
export const appSettings = {
  /**
   * Browser headless mode
   * true = browser runs invisibly (headless)
   * false = browser is visible during automation (default for better UX)
   * This can be toggled via Settings UI
   */
  browserHeadless: false,
};

/**
 * Get browser headless mode setting
 * Convenience function for readability
 */
export function getBrowserHeadless(): boolean {
  return appSettings.browserHeadless;
}

/**
 * Set browser headless mode
 * Should only be called from settings handlers
 */
export function setBrowserHeadless(value: boolean): void {
  const oldValue = appSettings.browserHeadless;
  appSettings.browserHeadless = value;

  // Use logger with lazy import to avoid circular dependency
  try {
    const logger = getLogger();
    logger.info('Browser headless mode updated', {
      oldValue,
      newValue: value,
      appSettingsBrowserHeadless: appSettings.browserHeadless,
    });
  } catch {
    // Fallback to console if logger is not available (shouldn't happen in normal operation)
    console.log('[Constants] Browser headless mode updated:', {
      oldValue,
      newValue: value,
      appSettingsBrowserHeadless: appSettings.browserHeadless,
    });
  }
}
