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
 * Uses ES module dynamic import with caching
 * @private
 */
let cachedLogger: { info: (message: string, context?: object) => void } | null = null;
let loggerImportPromise: Promise<{ appLogger: { info: (message: string, context?: object) => void } }> | null = null;

async function getLoggerAsync(): Promise<{ info: (message: string, context?: object) => void }> {
  if (cachedLogger) {
    return cachedLogger;
  }
  
  if (!loggerImportPromise) {
    loggerImportPromise = import("../../logger");
  }
  
  const module = await loggerImportPromise;
  cachedLogger = module.appLogger;
  return cachedLogger;
}

/**
 * Get logger synchronously - returns null if logger not yet loaded
 * Used for functions that can handle logger not being available
 * @private
 */
function getLogger(): { info: (message: string, context?: object) => void } | null {
  return cachedLogger;
}

/**
 * Application version
 * This should match the version in package.json
 * Updated: 2025-11-04
 */
export const APP_VERSION = "1.6.0";

/**
 * Application name
 */
export const APP_NAME = "Sheetpilot";

/**
 * Product name for display purposes
 */
export const PRODUCT_NAME = "Sheetpilot";

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
  // Since this is synchronous, we log asynchronously without blocking
  const logger = getLogger();
  if (logger) {
    logger.info("Browser headless mode updated", {
      oldValue,
      newValue: value,
      appSettingsBrowserHeadless: appSettings.browserHeadless,
    });
  } else {
    // Logger not yet loaded - initialize async and log
    getLoggerAsync()
      .then((log) => {
        log.info("Browser headless mode updated", {
          oldValue,
          newValue: value,
          appSettingsBrowserHeadless: appSettings.browserHeadless,
        });
      })
      .catch(() => {
        // Fallback to console if logger initialization fails
        console.log("[Constants] Browser headless mode updated:", {
          oldValue,
          newValue: value,
          appSettingsBrowserHeadless: appSettings.browserHeadless,
        });
      });
  }
}
