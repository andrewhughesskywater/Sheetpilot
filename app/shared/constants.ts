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
 * Application version
 * This should match the version in package.json
 * Updated: 2025-11-04
 */
export const APP_VERSION = '1.4.2';

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
