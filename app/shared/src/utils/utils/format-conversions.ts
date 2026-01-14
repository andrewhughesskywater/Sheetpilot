/**
 * @fileoverview Format Conversion Utilities
 * 
 * Centralized utilities for converting between different time and date formats
 * used throughout the application.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

/**
 * Converts time string (HH:mm) to minutes since midnight
 * 
 * @param timeStr - Time string in HH:mm format (e.g., "08:00", "17:30")
 * @returns Minutes since midnight (0-1439)
 * @throws Error if time format is invalid
 * 
 * @example
 * parseTimeToMinutes("08:00") // returns 480
 * parseTimeToMinutes("17:30") // returns 1050
 */
export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm`);
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm`);
  }
  return hours * 60 + minutes;
}

/**
 * Converts minutes since midnight to time string (HH:mm)
 * 
 * @param minutes - Minutes since midnight (0-1439)
 * @returns Time string in HH:mm format (e.g., "08:00", "17:30")
 * 
 * @example
 * formatMinutesToTime(480)  // returns "08:00"
 * formatMinutesToTime(1050) // returns "17:30"
 */
export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Converts date from YYYY-MM-DD to MM/DD/YYYY format
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date string in MM/DD/YYYY format
 * @throws Error if date format is invalid
 * 
 * @example
 * convertDateToUSFormat("2025-01-15") // returns "01/15/2025"
 */
export function convertDateToUSFormat(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  const [year, month, day] = parts;
  return `${month}/${day}/${year}`;
}

/**
 * Converts date from MM/DD/YYYY to YYYY-MM-DD format
 * 
 * @param dateStr - Date string in MM/DD/YYYY format
 * @returns Date string in YYYY-MM-DD format
 * @throws Error if date format is invalid
 * 
 * @example
 * convertDateToISOFormat("01/15/2025") // returns "2025-01-15"
 */
export function convertDateToISOFormat(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error(`Invalid date format: ${dateStr}. Expected MM/DD/YYYY`);
  }
  const [month, day, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Converts date from MM/DD/YYYY to YYYY-MM-DD format (handles both formats)
 * Useful when the input format is unknown
 * 
 * @param dateStr - Date string in either MM/DD/YYYY or YYYY-MM-DD format
 * @returns Date string in YYYY-MM-DD format
 * 
 * @example
 * normalizeDateToISO("01/15/2025") // returns "2025-01-15"
 * normalizeDateToISO("2025-01-15") // returns "2025-01-15"
 */
export function normalizeDateToISO(dateStr: string): string {
  if (dateStr.includes('/')) {
    return convertDateToISOFormat(dateStr);
  }
  // Already in ISO format or invalid - return as-is (caller should validate)
  return dateStr;
}

