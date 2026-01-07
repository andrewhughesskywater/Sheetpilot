/**
 * Quarter routing configuration (date → Smartsheet form).
 *
 * The bot uses quarter routing to ensure it submits entries to the correct form.
 * `getQuarterForDate()` expects **YYYY-MM-DD** (ISO-ish) dates.
 *
 * To add a new quarter:
 * 1. Add an entry to `QUARTER_DEFINITIONS`
 * 2. Ensure `startDate`/`endDate` use `YYYY-MM-DD`
 * 3. Set `formUrl` + `formId` to the matching Smartsheet form
 *
 * Callers who start with `mm/dd/yyyy` should convert before calling this module
 * (see `_validateQuarterMatch()` in `core/bot_orchestation.ts` for an example).
 */

/**
 * Quarter definition interface
 */
export interface QuarterDefinition {
  /** Quarter identifier (e.g., 'Q3-2025') */
  id: string;
  /** Human-readable quarter name */
  name: string;
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
  /** SmartSheet form URL */
  formUrl: string;
  /** SmartSheet form ID extracted from URL */
  formId: string;
}

/**
 * Available quarters configuration
 * 
 * To add new quarters:
 * 1. Add new QuarterDefinition to this array
 * 2. Specify date range and form URL/ID
 * 3. No other changes needed - routing logic automatically handles new quarters
 * 
 * Only the active quarters are allowed to be in this section and will change over the course of the year
 * 
 * ON PAIN OF DEATH, DO NOT CHANEGE THE QUARTER DEFINITIONS
 */
export const QUARTER_DEFINITIONS: QuarterDefinition[] = [
  {
    id: 'Q4-2025',
    name: 'Q4 2025',
    startDate: '2025-10-01',
    endDate: '2025-12-31',
    formUrl: 'https://app.smartsheet.com/b/form/0199fabee6497e60abb6030c48d84585',
    formId: '0199fabee6497e60abb6030c48d84585'
  },
  {
    id: 'Q1-2026',
    name: 'Q1 2026',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    formUrl: 'https://app.smartsheet.com/b/form/019b5b17a03a79ac9437e45996f49f4f',
    formId: '019b5b17a03a79ac9437e45996f49f4f'
  }
];

/**
 * Determines which quarter a date falls into
 * 
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Quarter definition if date falls within a quarter, null otherwise
 */
export function getQuarterForDate(dateStr: string): QuarterDefinition | null {
  // Validate format (YYYY-MM-DD)
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(dateStr)) return null;

  // Validate actual calendar date using UTC to avoid timezone offsets
  const year = Number(dateStr.slice(0, 4));
  const monthIndex = Number(dateStr.slice(5, 7)) - 1; // 0-based
  const day = Number(dateStr.slice(8, 10));
  const dt = new Date(Date.UTC(year, monthIndex, day));
  const isValidDate =
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === monthIndex &&
    dt.getUTCDate() === day;
  if (!isValidDate) return null;

  // ISO date strings are lexicographically sortable; compare as strings
  for (const quarter of QUARTER_DEFINITIONS) {
    if (dateStr >= quarter.startDate && dateStr <= quarter.endDate) return quarter;
  }
  return null;
}

/**
 * Validates if a date falls within any available quarter
 * 
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Error message if date is invalid or outside quarters, null if valid
 */
export function validateQuarterAvailability(dateStr: string): string | null {
  if (!dateStr) {
    return 'Please enter a date';
  }
  
  // Check if date falls within any quarter
  const quarter = getQuarterForDate(dateStr);
  if (!quarter) {
    // Create helpful error message listing available quarters
    const availableQuarters = QUARTER_DEFINITIONS.map(q => `${q.name} (${q.startDate.split('-')[1]}/${q.startDate.split('-')[2]}-${q.endDate.split('-')[1]}/${q.endDate.split('-')[2]})`).join(' or ');
    return `Date must be in ${availableQuarters}`;
  }
  
  return null;
}

/**
 * Groups timesheet entries by quarter
 * 
 * @param entries - Array of timesheet entries with date field
 * @returns Map of quarter ID to entries array
 */
export function groupEntriesByQuarter<T extends { date: string }>(entries: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  
  for (const entry of entries) {
    const quarter = getQuarterForDate(entry.date);
    if (quarter) {
      if (!grouped.has(quarter.id)) {
        grouped.set(quarter.id, []);
      }
      grouped.get(quarter.id)!.push(entry);
    }
  }
  
  return grouped;
}

/**
 * Gets all available quarter IDs
 * 
 * @returns Array of quarter IDs
 */
export function getAvailableQuarterIds(): string[] {
  return QUARTER_DEFINITIONS.map(q => q.id);
}

/**
 * Gets quarter definition by ID
 * 
 * @param quarterId - Quarter identifier
 * @returns Quarter definition if found, null otherwise
 */
export function getQuarterById(quarterId: string): QuarterDefinition | null {
  return QUARTER_DEFINITIONS.find(q => q.id === quarterId) || null;
}

/**
 * Gets the current quarter based on today's date
 * 
 * @returns Current quarter definition if today falls within a quarter, null otherwise
 */
export function getCurrentQuarter(): QuarterDefinition | null {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  if (!todayStr) {
    return null;
  }
  return getQuarterForDate(todayStr);
}
