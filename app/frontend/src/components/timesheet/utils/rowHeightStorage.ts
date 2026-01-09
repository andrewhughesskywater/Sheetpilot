/**
 * @fileoverview Row Height Storage Utility
 *
 * Handles persistence of timesheet grid row heights to localStorage.
 * Allows users to customize row heights and have them persist across sessions.
 */

const ROW_HEIGHT_STORAGE_KEY = 'sheetpilot_timesheet_row_height';

/**
 * Default row height in pixels
 */
const DEFAULT_ROW_HEIGHT = 24;

/**
 * Load saved row height from localStorage
 * @returns Row height in pixels, or null if not found
 */
export function loadRowHeight(): number | null {
  try {
    const stored = localStorage.getItem(ROW_HEIGHT_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as unknown;
    if (typeof parsed === 'number' && parsed > 0) {
      return parsed;
    }

    return null;
  } catch (error) {
    // Silently handle parse errors - return null to use defaults
    return null;
  }
}

/**
 * Save row height to localStorage
 * @param height Row height in pixels
 */
export function saveRowHeight(height: number): void {
  try {
    if (height > 0) {
      localStorage.setItem(ROW_HEIGHT_STORAGE_KEY, JSON.stringify(height));
    }
  } catch (error) {
    // Silently handle errors (e.g., QuotaExceededError)
    // Row height persistence is a nice-to-have, not critical
  }
}

/**
 * Get the default row height
 * @returns Default row height in pixels
 */
export function getDefaultRowHeight(): number {
  return DEFAULT_ROW_HEIGHT;
}
