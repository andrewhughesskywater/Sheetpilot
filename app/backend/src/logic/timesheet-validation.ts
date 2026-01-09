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

import { validateQuarterAvailability } from '../services/bot/src/config/quarter_config';
import { projectNeedsTools, toolNeedsChargeCode } from './dropdown-logic';

/**
 * Timesheet row interface
 */
export interface TimesheetRow {
  id?: number;
  date?: string;
  timeIn?: string;
  timeOut?: string;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
}

function isValidMonth(month: number): boolean {
  return month >= 1 && month <= 12;
}

function isValidDay(day: number): boolean {
  return day >= 1 && day <= 31;
}

function isValidYear(year: number): boolean {
  return year >= 1900 && year <= 2500;
}

function parseUSDateFormat(dateStr: string): { month: number; day: number; year: number } | null {
  const usFormatMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!usFormatMatch) return null;

  const month = parseInt(usFormatMatch[1]!, 10);
  const day = parseInt(usFormatMatch[2]!, 10);
  const year = parseInt(usFormatMatch[3]!, 10);

  return { month, day, year };
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
  const parsed = parseUSDateFormat(dateStr);
  if (!parsed) return false;

  // Validate ranges
  if (!isValidMonth(parsed.month)) return false;
  if (!isValidDay(parsed.day)) return false;
  if (!isValidYear(parsed.year)) return false;

  // Create date object using ISO format to avoid locale issues
  // Note: month is 0-indexed in Date constructor
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);

  // Check if the date is valid
  if (isNaN(date.getTime())) return false;

  // Verify the date components match what we parsed
  // This catches issues like Feb 29 in non-leap years
  const actualMonth = date.getMonth() + 1; // getMonth() returns 0-11
  const actualDay = date.getDate();
  const actualYear = date.getFullYear();

  return actualMonth === parsed.month && actualDay === parsed.day && actualYear === parsed.year;
}

/**
 * Check if time string has invalid characters
 */
function hasInvalidTimeCharacters(timeStr: string): boolean {
  return (
    timeStr.includes('-') || // Negative values
    timeStr.includes('.') || // Decimal notation
    timeStr.includes('e') ||
    timeStr.includes('E') || // Scientific notation
    timeStr.length > 5
  ); // Too long (likely invalid)
}

/**
 * Normalize time string in HH:MM format
 */
function normalizeTimeFormat(timeStr: string): string | null {
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;

  const [hours, minutes] = parts;
  if (!hours || minutes === undefined) return null;

  const hoursNum = parseInt(hours, 10);
  const minutesNum = parseInt(minutes, 10);
  if (isNaN(hoursNum) || isNaN(minutesNum) || hoursNum >= 24 || minutesNum >= 60) {
    return null;
  }

  const normalizedHours = hours.padStart(2, '0');
  const normalizedMinutes = minutes.padStart(2, '0');
  return `${normalizedHours}:${normalizedMinutes}`;
}

/**
 * Format 3-digit numeric input (800 -> 08:00)
 */
function formatThreeDigitTime(numericOnly: string): string {
  const hours = numericOnly.substring(0, 1);
  const minutes = numericOnly.substring(1, 3);
  return `${hours.padStart(2, '0')}:${minutes}`;
}

/**
 * Format 4-digit numeric input (1430 -> 14:30)
 */
function formatFourDigitTime(numericOnly: string, original: string): string {
  const hours = numericOnly.substring(0, 2);
  const minutes = numericOnly.substring(2, 4);
  const hoursNum = parseInt(hours, 10);
  const minutesNum = parseInt(minutes, 10);

  if (hoursNum >= 24 || minutesNum >= 60) {
    return original; // Invalid time, return original
  }
  return `${hours}:${minutes}`;
}

/**
 * Format numeric-only time input based on length
 */
function formatNumericTime(numericOnly: string, original: string): string {
  if (numericOnly.length === 3) {
    return formatThreeDigitTime(numericOnly);
  }
  if (numericOnly.length === 4) {
    return formatFourDigitTime(numericOnly, original);
  }
  if (numericOnly.length === 2) {
    const hoursNum = parseInt(numericOnly, 10);
    if (hoursNum >= 24) return original;
    return `${numericOnly}:00`;
  }
  if (numericOnly.length === 1) {
    return `${numericOnly.padStart(2, '0')}:00`;
  }
  return original;
}

/**
 * Format numeric time input (e.g., 800 -> 08:00, 1430 -> 14:30)
 */
export function formatTimeInput(timeStr: unknown): string {
  // Convert numbers to strings first
  const timeString = typeof timeStr === 'number' ? String(timeStr) : timeStr;

  if (typeof timeString !== 'string') return String(timeString || '');

  // Handle special edge cases - return original for invalid inputs
  if (hasInvalidTimeCharacters(timeString)) {
    return timeString;
  }

  // If already in HH:MM format, normalize it to ensure proper padding
  if (timeString.includes(':')) {
    const normalized = normalizeTimeFormat(timeString);
    return normalized || timeString;
  }

  // Remove any non-numeric characters for pure numeric input
  const numericOnly = timeString.replace(/\D/g, '');

  // If no numeric content, return original
  if (!numericOnly) return timeString;

  return formatNumericTime(numericOnly, timeString);
}

/**
 * Check if a time string is valid (HH:MM format, 15-minute increments)
 */
export function isValidTime(timeStr?: string): boolean {
  if (!timeStr) return false;

  // First try to format the input
  const formattedTime = formatTimeInput(timeStr);

  // Check if it matches HH:MM format
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(formattedTime)) return false;

  const [hours, minutes] = formattedTime.split(':').map(Number);
  if (hours === undefined || minutes === undefined) return false;
  const totalMinutes = hours * 60 + minutes;

  // Check if it's a multiple of 15 minutes
  return totalMinutes % 15 === 0;
}

/**
 * Check if time out is after time in
 */
export function isTimeOutAfterTimeIn(timeIn?: string, timeOut?: string): boolean {
  if (!timeIn || !timeOut) return true; // Let other validations handle missing values

  const [inHours, inMinutes] = timeIn.split(':').map(Number);
  const [outHours, outMinutes] = timeOut.split(':').map(Number);

  if (inHours === undefined || inMinutes === undefined || outHours === undefined || outMinutes === undefined) {
    return true; // Let other validations handle invalid time formats
  }

  const inTotalMinutes = inHours * 60 + inMinutes;
  const outTotalMinutes = outHours * 60 + outMinutes;

  return outTotalMinutes > inTotalMinutes;
}

/**
 * Configuration for field validation
 */
interface ValidateFieldConfig {
  value: unknown;
  row: number;
  prop: string | number;
  rows: TimesheetRow[];
  projects: string[];
  chargeCodes: string[];
}

/**
 * Validate date field
 */
function validateDateField(value: unknown): string | null {
  if (!value) return 'Date is required - please enter a date';
  if (!isValidDate(String(value))) return 'Date must be like 01/15/2024 or 2024-01-15';

  // Convert mm/dd/yyyy to yyyy-mm-dd for quarter validation
  const dateStr = String(value);
  const [month, day, year] = dateStr.split('/');
  if (!month || !day || !year) return 'Date must be like 01/15/2024';
  const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  // Validate quarter availability
  const quarterError = validateQuarterAvailability(isoDate);
  return quarterError || null;
}

/**
 * Validate timeIn field
 */
function validateTimeInField(value: unknown): string | null {
  if (!value) return 'Start time is required - please enter start time';
  if (!isValidTime(String(value))) return 'Time must be like 09:00, 800, or 1430 and in 15 minute steps';
  return null;
}

/**
 * Validate timeOut field
 */
function validateTimeOutField(value: unknown, timeIn?: string): string | null {
  if (!value) return 'End time is required - please enter end time';
  if (!isValidTime(String(value))) return 'Time must be like 17:00, 1700, or 530 and in 15 minute steps';
  if (!isTimeOutAfterTimeIn(timeIn, String(value))) return 'End time must be after start time';
  return null;
}

/**
 * Validate project field
 */
function validateProjectField(value: unknown, projects: string[]): string | null {
  if (!value) return 'Project is required - please pick a project';
  if (!projects.includes(String(value))) return 'Please pick from the list';
  return null;
}

/**
 * Validate tool field
 */
function validateToolField(value: unknown, project?: string): string | null {
  if (!projectNeedsTools(project)) {
    // Tool is N/A for this project, normalize to null
    return null;
  }
  if (!value) return 'Please pick a tool for this project';
  // Tool validation against valid list is handled by dropdown
  return null;
}

/**
 * Validate chargeCode field
 */
function validateChargeCodeField(
  value: unknown,
  tool: string | null | undefined,
  chargeCodes: string[]
): string | null {
  if (!toolNeedsChargeCode(tool || undefined)) {
    // Charge code is N/A for this tool, normalize to null
    return null;
  }
  if (!value) return 'Please pick a charge code for this tool';
  if (!chargeCodes.includes(String(value))) return 'Please pick from the list';
  return null;
}

/**
 * Validate taskDescription field
 */
function validateTaskDescriptionField(value: unknown): string | null {
  if (!value) return 'Task description is required - please describe what you did';
  return null;
}

/**
 * Validate a specific field in a timesheet row
 */
function validateFieldInternal(config: ValidateFieldConfig): string | null {
  const { value, row, prop, rows, projects, chargeCodes } = config;
  const rowData = rows[row];

  const validators: Record<
    string,
    (args: { value: unknown; rowData: (typeof rows)[number] | undefined }) => string | null
  > = {
    date: ({ value }) => validateDateField(value),
    timeIn: ({ value }) => validateTimeInField(value),
    timeOut: ({ value, rowData }) => validateTimeOutField(value, rowData?.timeIn),
    project: ({ value }) => validateProjectField(value, projects),
    tool: ({ value, rowData }) => validateToolField(value, rowData?.project),
    chargeCode: ({ value, rowData }) => validateChargeCodeField(value, rowData?.tool, chargeCodes),
    taskDescription: ({ value }) => validateTaskDescriptionField(value),
  };

  const validator = validators[prop];
  return validator ? validator({ value, rowData }) : null;
}

/**
 * Validate a specific field in a timesheet row
 */
export function validateField(config: ValidateFieldConfig): string | null {
  return validateFieldInternal(config);
}
