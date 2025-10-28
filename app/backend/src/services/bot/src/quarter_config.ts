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
    id: 'Q1-2025',
    name: 'Q1 2025',
    startDate: '2025-01-01',
    endDate: '2025-03-31',
    formUrl: 'https://app.smartsheet.com/b/form/q1-2025-placeholder',
    formId: 'q1-2025-placeholder'
  },
  {
    id: 'Q2-2025',
    name: 'Q2 2025',
    startDate: '2025-04-01',
    endDate: '2025-06-30',
    formUrl: 'https://app.smartsheet.com/b/form/q2-2025-placeholder',
    formId: 'q2-2025-placeholder'
  },
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
    formUrl: 'https://app.smartsheet.com/b/form/0199fabee6497e60abb6030c48d84585',
    formId: '0199fabee6497e60abb6030c48d84585'
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
  
  // Parse date components and validate
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);
  
  // Validate parsed values
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }
  
  const targetDate = new Date(year, month - 1, day);
  
  // Check if the date is valid by comparing with original components
  if (targetDate.getFullYear() !== year || 
      targetDate.getMonth() !== month - 1 || 
      targetDate.getDate() !== day) {
    return null;
  }
  
  // Check each quarter definition
  for (const quarter of QUARTER_DEFINITIONS) {
    const [startYearStr, startMonthStr, startDayStr] = quarter.startDate.split('-');
    const [endYearStr, endMonthStr, endDayStr] = quarter.endDate.split('-');
    
    const startYear = parseInt(startYearStr!, 10);
    const startMonth = parseInt(startMonthStr!, 10);
    const startDay = parseInt(startDayStr!, 10);
    const endYear = parseInt(endYearStr!, 10);
    const endMonth = parseInt(endMonthStr!, 10);
    const endDay = parseInt(endDayStr!, 10);
    
    // Validate parsed values
    if (isNaN(startYear) || isNaN(startMonth) || isNaN(startDay) || 
        isNaN(endYear) || isNaN(endMonth) || isNaN(endDay)) {
      continue;
    }
    
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);
    
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
