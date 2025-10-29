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
import { validateQuarterAvailability } from '../services/bot/src/quarter_config';

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

/**
 * Check if a date string is valid
 */
export function isValidDate(dateStr?: string): boolean {
  if (!dateStr) return false;
  
  // Must match mm/dd/yyyy format
  const formatMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!formatMatch) return false;
  
  const month = parseInt(formatMatch[1]!, 10);
  const day = parseInt(formatMatch[2]!, 10);
  const year = parseInt(formatMatch[3]!, 10);
  
  // Validate ranges
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;
  
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
 * Format numeric time input (e.g., 800 -> 08:00, 1430 -> 14:30)
 */
export function formatTimeInput(timeStr: unknown): string {
  if (typeof timeStr !== 'string') return String(timeStr || '');
  
  // If already in HH:MM format, normalize it to ensure proper padding
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const [hours, minutes] = parts;
      if (hours && minutes !== undefined) {
        const normalizedHours = hours.padStart(2, '0');
        const normalizedMinutes = minutes.padStart(2, '0');
        return `${normalizedHours}:${normalizedMinutes}`;
      }
    }
    // For invalid formats like HH:MM:SS, return original input
    return timeStr;
  }
  
  // Remove any non-numeric characters for pure numeric input
  const numericOnly = timeStr.replace(/\D/g, '');
  
  // Handle different numeric input formats
  if (numericOnly.length === 3) {
    // 800 -> 08:00
    const hours = numericOnly.substring(0, 1);
    const minutes = numericOnly.substring(1, 3);
    return `${hours.padStart(2, '0')}:${minutes}`;
  } else if (numericOnly.length === 4) {
    // 1430 -> 14:30
    const hours = numericOnly.substring(0, 2);
    const minutes = numericOnly.substring(2, 4);
    return `${hours}:${minutes}`;
  } else if (numericOnly.length === 2) {
    // Two-digit input: treat as hours (08 -> 08:00, 12 -> 12:00)
    return `${numericOnly}:00`;
  } else if (numericOnly.length === 1) {
    // 8 -> 08:00
    return `${numericOnly.padStart(2, '0')}:00`;
  }
  
  // Return original if it doesn't match expected patterns
  return timeStr;
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
    case 'date': {
      if (!value) return 'Date is required - please enter a date';
      if (!isValidDate(String(value))) return 'Date must be like 01/15/2024';
      
      // Convert mm/dd/yyyy to yyyy-mm-dd for quarter validation
      const dateStr = String(value);
      const [month, day, year] = dateStr.split('/');
      if (!month || !day || !year) return 'Date must be like 01/15/2024';
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      // Validate quarter availability
      const quarterError = validateQuarterAvailability(isoDate);
      if (quarterError) return quarterError;
      
      return null;
    }
      
    case 'timeIn': {
      if (!value) return 'Start time is required - please enter start time';
      if (!isValidTime(String(value))) return 'Time must be like 09:00, 800, or 1430 and in 15 minute steps';
      return null;
    }
      
    case 'timeOut': {
      if (!value) return 'End time is required - please enter end time';
      if (!isValidTime(String(value))) return 'Time must be like 17:00, 1700, or 530 and in 15 minute steps';
      if (!isTimeOutAfterTimeIn(rowData?.timeIn, String(value))) return 'End time must be after start time';
      return null;
    }
      
    case 'project':
      if (!value) return 'Project is required - please pick a project';
      if (!projects.includes(String(value))) return 'Please pick from the list';
      return null;
      
    case 'tool': {
      const project = rowData?.project;
      if (!projectNeedsTools(project)) {
        // Tool is N/A for this project, normalize to null
        return null;
      }
      if (!value) return 'Please pick a tool for this project';
      // Tool validation against valid list is handled by dropdown
      return null;
    }
      
    case 'chargeCode': {
      const tool = rowData?.tool;
      if (!toolNeedsChargeCode(tool || undefined)) {
        // Charge code is N/A for this tool, normalize to null
        return null;
      }
      if (!value) return 'Please pick a charge code for this tool';
      if (!chargeCodes.includes(String(value))) return 'Please pick from the list';
      return null;
    }
      
    case 'taskDescription':
      if (!value) return 'Task description is required - please describe what you did';
      return null;
      
    default:
      return null;
  }
}

