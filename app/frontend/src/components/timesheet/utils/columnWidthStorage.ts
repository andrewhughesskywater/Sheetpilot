/**
 * @fileoverview Column Width Storage Utility
 * 
 * Handles persistence of timesheet grid column widths to localStorage.
 * Allows users to customize column widths and have them persist across sessions.
 */

const COLUMN_WIDTH_STORAGE_KEY = 'sheetpilot_timesheet_column_widths';

/**
 * Column width map: maps column data key to width in pixels
 */
export type ColumnWidthMap = Record<string, number>;

/**
 * Load saved column widths from localStorage
 * @returns Map of column data keys to widths, or null if not found
 */
export function loadColumnWidths(): ColumnWidthMap | null {
  try {
    const stored = localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    
    // Validate that all values are numbers
    const widthMap: ColumnWidthMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && value > 0) {
        widthMap[key] = value;
      }
    }
    
    return Object.keys(widthMap).length > 0 ? widthMap : null;
  } catch (error) {
    // Silently handle parse errors - return null to use defaults
    return null;
  }
}

/**
 * Save column widths to localStorage
 * @param widths Map of column data keys to widths
 */
export function saveColumnWidths(widths: ColumnWidthMap): void {
  try {
    localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(widths));
  } catch (error) {
    // Silently handle errors (e.g., QuotaExceededError)
    // Column width persistence is a nice-to-have, not critical
  }
}

/**
 * Save a single column width
 * @param columnDataKey The data key of the column (e.g., 'date', 'project')
 * @param width The width in pixels
 */
export function saveColumnWidth(columnDataKey: string, width: number): void {
  const existing = loadColumnWidths() ?? {};
  existing[columnDataKey] = width;
  saveColumnWidths(existing);
}

/**
 * Get the saved width for a specific column
 * @param columnDataKey The data key of the column
 * @returns The saved width, or null if not found
 */
export function getColumnWidth(columnDataKey: string): number | null {
  const widths = loadColumnWidths();
  return widths?.[columnDataKey] ?? null;
}
