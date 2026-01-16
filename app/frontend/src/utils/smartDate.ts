/**
 * @fileoverview Smart Date Utility
 * 
 * Provides intelligent date suggestions and validation for timesheet date entry.
 * Includes quarter range validation, pattern detection, and date manipulation helpers.
 * 
 * @author SheetPilot Team
 * @version 1.0.0
 */

import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';
import { ALLOWED_PREVIOUS_QUARTERS } from '@sheetpilot/shared';

/**
 * Get the quarter (1-4) for a given date
 */
function getQuarter(date: Date): number {
  const month = date.getMonth(); // 0-11
  return Math.floor(month / 3) + 1; // 1-4
}

/**
 * Get the start and end dates for a given quarter and year
 */
function getQuarterBounds(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0); // Last day of the quarter's last month
  
  return { start, end };
}

/**
 * Calculate the allowed date range based on current date and ALLOWED_PREVIOUS_QUARTERS setting
 * @returns Object with minDate and maxDate as Date objects
 */
export function getQuarterDateRange(): { minDate: Date; maxDate: Date } {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentQuarter = getQuarter(today);
  
  // Current quarter bounds
  const currentBounds = getQuarterBounds(currentYear, currentQuarter);
  
  // Max date is end of current quarter
  const maxDate = currentBounds.end;
  
  // Min date depends on ALLOWED_PREVIOUS_QUARTERS
  let minDate: Date;
  
  if ((ALLOWED_PREVIOUS_QUARTERS as number) === 0) {
    // Only current quarter
    minDate = currentBounds.start;
  } else {
    // Current + previous quarter(s)
    let targetQuarter = currentQuarter - ALLOWED_PREVIOUS_QUARTERS;
    let targetYear = currentYear;
    
    // Handle year rollover
    while (targetQuarter < 1) {
      targetQuarter += 4;
      targetYear -= 1;
    }
    
    const previousBounds = getQuarterBounds(targetYear, targetQuarter);
    minDate = previousBounds.start;
  }
  
  return { minDate, maxDate };
}

/**
 * Check if a date string (MM/DD/YYYY) is within the allowed quarter range
 */
export function isDateInAllowedRange(dateStr: string): boolean {
  if (!dateStr) return false;
  
  const date = parseDateString(dateStr);
  if (!date) return false;
  
  const { minDate, maxDate } = getQuarterDateRange();
  
  // Reset time components for accurate comparison
  date.setHours(0, 0, 0, 0);
  minDate.setHours(0, 0, 0, 0);
  maxDate.setHours(23, 59, 59, 999);
  
  return date >= minDate && date <= maxDate;
}

/**
 * Parse a date string in MM/DD/YYYY format to a Date object
 * Returns null if invalid format or invalid date values
 */
type DateParts = {
  month: number;
  day: number;
  year: number;
};

const parseDateSegments = (dateStr: string): DateParts | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0] || '', 10);
  const day = parseInt(parts[1] || '', 10);
  const year = parseInt(parts[2] || '', 10);

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

  return { month, day, year };
};

const isValidDateParts = ({ month, day, year }: DateParts): boolean => {
  // Validate month range (1-12)
  if (month < 1 || month > 12) return false;

  // Validate day range (1-31)
  if (day < 1 || day > 31) return false;

  // Month is 0-indexed in Date constructor
  const date = new Date(year, month - 1, day);

  // Validate that the date components didn't overflow (e.g., Feb 30 becomes Mar 2)
  return (
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getFullYear() === year
  );
};

export function parseDateString(dateStr: string): Date | null {
  const parts = parseDateSegments(dateStr);
  if (!parts || !isValidDateParts(parts)) {
    return null;
  }
  return new Date(parts.year, parts.month - 1, parts.day);
}

/**
 * Format a Date object to MM/DD/YYYY string
 */
export function formatDateForDisplay(date: Date): string {
  const month = date.getMonth() + 1; // 0-indexed to 1-indexed
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${month}/${day}/${year}`;
}

/**
 * Add or subtract days from a date string (MM/DD/YYYY)
 * @param dateStr Date string in MM/DD/YYYY format
 * @param days Number of days to add (positive) or subtract (negative)
 * @param skipWeekends If true, skip weekend days when incrementing
 * @returns New date string in MM/DD/YYYY format, or empty string if invalid
 */
export function incrementDate(dateStr: string, days: number, skipWeekends = false): string {
  const date = parseDateString(dateStr);
  if (!date) return '';
  
  const currentDate = new Date(date);
  let daysToAdd = Math.abs(days);
  const direction = days > 0 ? 1 : -1;
  
  while (daysToAdd > 0) {
    currentDate.setDate(currentDate.getDate() + direction);
    
    if (skipWeekends) {
      const dayOfWeek = currentDate.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysToAdd--;
      }
    } else {
      daysToAdd--;
    }
  }
  
  return formatDateForDisplay(currentDate);
}

/**
 * Detect if the timesheet rows follow a weekday-only pattern
 * Returns true if all dates with valid format are weekdays (no Saturdays or Sundays)
 */
export function detectWeekdayPattern(rows: TimesheetRow[]): boolean {
  const validDates: Date[] = [];
  
  for (const row of rows) {
    if (row.date) {
      const date = parseDateString(row.date);
      if (date) {
        validDates.push(date);
      }
    }
  }
  
  // Need at least 3 dates to detect a pattern
  if (validDates.length < 3) {
    return false;
  }
  
  // Check if all dates are weekdays
  for (const date of validDates) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Found a weekend day
      return false;
    }
  }
  
  return true;
}

/**
 * Get smart placeholder date based on context
 * @param previousRow The row immediately before the current one
 * @param _allRows All timesheet rows for pattern detection
 * @param _skipWeekends Whether to skip weekends when incrementing
 * @returns Suggested date string in MM/DD/YYYY format
 */
export function getSmartPlaceholder(
  previousRow: TimesheetRow | undefined,
  _allRows: TimesheetRow[],
  _skipWeekends: boolean
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // No previous row → suggest today
  if (!previousRow || !previousRow.date) {
    return formatDateForDisplay(today);
  }
  
  const previousDate = parseDateString(previousRow.date);
  if (!previousDate) {
    return formatDateForDisplay(today);
  }
  
  previousDate.setHours(0, 0, 0, 0);
  
  // Calculate days between previous entry and today
  const daysDiff = Math.floor((today.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Previous row is more than 1 day old → suggest today
  if (daysDiff > 1) {
    return formatDateForDisplay(today);
  }
  
  // Previous row is recent (≤1 day)
  // Suggest same date as previous row
  return previousRow.date;
}

