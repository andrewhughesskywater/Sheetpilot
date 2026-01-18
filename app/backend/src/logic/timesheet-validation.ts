/**
 * @fileoverview Timesheet Validation Logic
 * 
 * Pure validation functions for timesheet entries.
 * Extracted from TimesheetGrid component for reusability.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { projectNeedsTools, toolNeedsChargeCode } from './dropdown-logic';
import { validateQuarterAvailability } from '@sheetpilot/bot';

/**
 * Timesheet row interface
 */
export interface TimesheetRow {
  id?: number;
  date?: string;
  hours?: number | undefined;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
}

/**
 * Check if a date string is valid
 * Accepts both MM/DD/YYYY and YYYY-MM-DD formats
 */
export function isValidDate(dateStr?: string): boolean {
  // Check if input is a string type
  if (typeof dateStr !== 'string') return false;
  if (!dateStr) return false;
  
  // Check for MM/DD/YYYY or M/D/YYYY format (slash-separated only)
  const usFormatMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!usFormatMatch) return false;
  
  const month = parseInt(usFormatMatch[1]!, 10);
  const day = parseInt(usFormatMatch[2]!, 10);
  const year = parseInt(usFormatMatch[3]!, 10);
  
  // Validate ranges
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2500) return false;
  
  // Create date object using ISO format to avoid locale issues
  // Note: month is 0-indexed in Date constructor
  const date = new Date(year, month - 1, day);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) return false;
  
  // Verify the date components match what we parsed
  // This catches issues like Feb 29 in non-leap years
  const actualMonth = date.getMonth() + 1; // getMonth() returns 0-11
  const actualDay = date.getDate();
  const actualYear = date.getFullYear();
  
  return actualMonth === month && actualDay === day && actualYear === year;
}

/**
 * Check if hours value is valid
 * 
 * Validates that hours is:
 * - A number
 * - In 15-minute increments (multiple of 0.25)
 * - Within range: 0.25 to 24.0 hours
 * 
 * @param hours - Hours value to validate
 * @returns true if valid, false otherwise
 */
export function isValidHours(hours?: number | null): boolean {
  if (hours === undefined || hours === null) return false;
  if (typeof hours !== 'number' || isNaN(hours)) return false;
  
  // Check if it's a multiple of 0.25 (15-minute increments)
  // Use modulo with tolerance for floating point precision
  const remainder = (hours * 4) % 1;
  if (Math.abs(remainder) > 0.0001 && Math.abs(remainder - 1) > 0.0001) {
    return false;
  }
  
  // Check range: 0.25 to 24.0
  return hours >= 0.25 && hours <= 24.0;
}

const toIsoDateForQuarterCheck = (dateStr: string): string | null => {
  const [month, day, year] = dateStr.split('/');
  if (!month || !day || !year) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const validateDateField = (value: unknown): string | null => {
  if (!value) return 'Date is required - please enter a date';
  if (!isValidDate(String(value))) {
    return 'Date must be like 01/15/2024 or 2024-01-15';
  }

  const isoDate = toIsoDateForQuarterCheck(String(value));
  if (!isoDate) return 'Date must be like 01/15/2024';

  const quarterError = validateQuarterAvailability(isoDate);
  if (quarterError) return quarterError;

  return null;
};

const validateHoursField = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') {
    return 'Hours is required - please enter hours worked';
  }

  const hoursValue = typeof value === 'number' ? value : Number(value);
  if (isNaN(hoursValue)) {
    return 'Hours must be a number (e.g., 1.25, 1.5, 2.0)';
  }

  if (!isValidHours(hoursValue)) {
    return 'Hours must be between 0.25 and 24.0 in 15-minute increments (0.25, 0.5, 0.75, etc.)';
  }

  return null;
};

const validateProjectField = (
  value: unknown,
  projects: string[]
): string | null => {
  if (!value) return 'Project is required - please pick a project';
  if (!projects.includes(String(value))) return 'Please pick from the list';
  return null;
};

const validateToolField = (
  value: unknown,
  project?: string
): string | null => {
  if (!projectNeedsTools(project)) {
    return null;
  }
  if (!value) return 'Please pick a tool for this project';
  return null;
};

const validateChargeCodeField = (
  value: unknown,
  tool: string | null | undefined,
  chargeCodes: string[]
): string | null => {
  if (!toolNeedsChargeCode(tool || undefined)) {
    return null;
  }
  if (!value) return 'Please pick a charge code for this tool';
  if (!chargeCodes.includes(String(value))) return 'Please pick from the list';
  return null;
};

const validateTaskDescriptionField = (value: unknown): string | null => {
  if (!value) {
    return 'Task description is required - please describe what you did';
  }
  return null;
};

/**
 * Validate a specific field in a timesheet row
 */
export function validateField(
  value: unknown,
  row: number,
  prop: string | number,
  rows: TimesheetRow[],
  projects: string[],
  chargeCodes: string[]
): string | null {
  const rowData = rows[row];
  
  switch (prop) {
    case 'date':
      return validateDateField(value);
    case 'hours':
      return validateHoursField(value);
    case 'project':
      return validateProjectField(value, projects);
    case 'tool':
      return validateToolField(value, rowData?.project);
    case 'chargeCode':
      return validateChargeCodeField(value, rowData?.tool, chargeCodes);
    case 'taskDescription':
      return validateTaskDescriptionField(value);
    default:
      return null;
  }
}

/**
 * Validate a time string (HH:MM or numeric format)
 * Times must be in 15-minute increments
 * 
 * @param time - Time string to validate (e.g., "09:00", "900")
 * @returns true if valid, false otherwise
 */
export function isValidTime(time?: string): boolean {
  if (typeof time !== 'string') return false;
  if (!time) return false;

  let minutes: number;

  // Try numeric format (e.g., "900" = 9:00 AM = 540 minutes)
  if (/^\d+$/.test(time)) {
    minutes = parseInt(time, 10);
  } else {
    // Try HH:MM format
    const match = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;

    const hours = parseInt(match[1]!, 10);
    const mins = parseInt(match[2]!, 10);

    // Validate ranges
    if (hours < 0 || hours > 23) return false;
    if (mins < 0 || mins > 59) return false;

    // Must be in 15-minute increments
    if (mins % 15 !== 0) return false;

    minutes = hours * 60 + mins;
  }

  // Validate range: 0 to 1439 (0:00 to 23:45)
  if (minutes < 0 || minutes > 1439) return false;

  // Must be in 15-minute increments
  if (minutes % 15 !== 0) return false;

  return true;
}

/**
 * Validate that timeOut is after timeIn
 * Both should be valid time strings
 * 
 * @param timeIn - Start time (e.g., "09:00")
 * @param timeOut - End time (e.g., "17:00")
 * @returns true if timeOut is after timeIn, false otherwise
 */
export function isTimeOutAfterTimeIn(timeIn?: string, timeOut?: string): boolean {
  if (!isValidTime(timeIn) || !isValidTime(timeOut)) return false;

  let inMinutes: number;
  let outMinutes: number;

  // Convert timeIn to minutes
  if (/^\d+$/.test(timeIn || '')) {
    inMinutes = parseInt(timeIn!, 10);
  } else {
    const match = (timeIn || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    inMinutes = parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10);
  }

  // Convert timeOut to minutes
  if (/^\d+$/.test(timeOut || '')) {
    outMinutes = parseInt(timeOut!, 10);
  } else {
    const match = (timeOut || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    outMinutes = parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10);
  }

  // timeOut must be strictly greater than timeIn
  return outMinutes > inMinutes;
}

