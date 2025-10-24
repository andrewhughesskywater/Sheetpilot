/**
 * @fileoverview Quarter Configuration - Defines quarters and form routing
 * 
 * This module contains quarter definitions, date-to-quarter mapping logic,
 * and validation functions for routing timesheet entries to appropriate forms.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
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
 */
export const QUARTER_DEFINITIONS: QuarterDefinition[] = [
  {
    id: 'Q3-2025',
    name: 'Q3 2025',
    startDate: '2025-07-01',
    endDate: '2025-09-30',
    formUrl: 'https://app.smartsheet.com/b/form/0197cbae7daf72bdb96b3395b500d414',
    formId: '0197cbae7daf72bdb96b3395b500d414'
  },
  {
    id: 'Q4-2025',
    name: 'Q4 2025',
    startDate: '2025-10-01',
    endDate: '2025-12-31',
    formUrl: 'https://app.smartsheet.com/sheets/g2X3m4H62qmg545FPmFVwhG5mwvc4WhwR779mr91/forms/3008824946190',
    formId: '3008824946190'
  }
];

/**
 * Determines which quarter a date falls into
 * 
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Quarter definition if date falls within a quarter, null otherwise
 */
export function getQuarterForDate(dateStr: string): QuarterDefinition | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return null;
  }
  
  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) {
    return null;
  }
  
  // Check each quarter definition
  for (const quarter of QUARTER_DEFINITIONS) {
    const startDate = new Date(quarter.startDate);
    const endDate = new Date(quarter.endDate);
    
    if (targetDate >= startDate && targetDate <= endDate) {
      return quarter;
    }
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
