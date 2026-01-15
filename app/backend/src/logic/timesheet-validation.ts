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
  hours?: number;
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
      if (!isValidDate(String(value))) return 'Date must be like 01/15/2024 or 2024-01-15';
      
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
      
    case 'hours': {
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

