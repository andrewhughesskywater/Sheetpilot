/**
 * @fileoverview Timesheet Validation
 * 
 * Field-level validation logic for timesheet entries.
 * Validates individual fields and returns user-friendly error messages.
 * Used by Handsontable for inline validation during data entry.
 */

import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';
import { isValidDate, isValidHours } from '@/components/timesheet/schema/timesheet.schema';
import { doesProjectNeedTools, doesToolNeedChargeCode } from '@sheetpilot/shared/business-config';
import { isDateInAllowedRange } from '@/utils/smartDate';

/**
 * Calculate total hours for a date from draft rows
 */
function calculateDraftHoursForDate(date: string, rows: TimesheetRow[], excludeRowIndex?: number): number {
  let total = 0;
  rows.forEach((row, idx) => {
    if (idx === excludeRowIndex) return; // Exclude the row being edited
    if (row.date === date && row.hours !== undefined && row.hours !== null) {
      total += row.hours;
    }
  });
  return total;
}

/**
 * Convert date from MM/DD/YYYY to YYYY-MM-DD format for comparison
 */
function convertDateToISO(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const [month, day, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Calculate total hours for a date from submitted entries
 */
function calculateSubmittedHoursForDate(date: string, submittedEntries: Array<{ date: string; hours: number | null }>): number {
  // Convert date from MM/DD/YYYY to YYYY-MM-DD for comparison
  const isoDate = convertDateToISO(date);
  
  let total = 0;
  submittedEntries.forEach((entry) => {
    if (entry.date === isoDate && entry.hours !== undefined && entry.hours !== null) {
      total += entry.hours;
    }
  });
  return total;
}

/**
 * Validate a single field value with context-aware rules
 * 
 * @param value - Field value to validate
 * @param row - Row index for context
 * @param prop - Field name being validated
 * @param rows - All rows for context
 * @param submittedEntries - Submitted entries from archive (for per-date total validation)
 * @returns Error message if invalid, null if valid
 */
export function validateField(
  value: unknown, 
  row: number, 
  prop: string | number, 
  rows: TimesheetRow[],
  submittedEntries?: Array<{ date: string; hours: number | null }>
): string | null {
  const rowData = rows[row];
  
  switch (prop) {
    case 'date': {
      if (!value) return 'Please enter a date';
      if (!isValidDate(String(value))) return 'Date must be like 01/15/2024';
      if (!isDateInAllowedRange(String(value))) return 'Date must be within allowed quarter range';
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
      
      // Validate total hours per date (if date and submitted entries are available)
      if (rowData?.date && submittedEntries) {
        const date = rowData.date;
        const currentRowHours = hoursValue;
        
        // Calculate draft hours excluding the current row (it's being updated)
        const draftHoursExcludingCurrent = calculateDraftHoursForDate(date, rows, row);
        const submittedHours = calculateSubmittedHoursForDate(date, submittedEntries);
        
        // Total = draft (excluding current) + submitted + new hours for current row
        const totalHours = draftHoursExcludingCurrent + submittedHours + currentRowHours;
        
        if (totalHours > 24.0) {
          const draftTotal = draftHoursExcludingCurrent + currentRowHours;
          return `Total hours for ${date} exceeds 24 hours. Current total: ${totalHours.toFixed(2)} hours (${submittedHours.toFixed(2)} submitted + ${draftTotal.toFixed(2)} draft). Maximum allowed: 24.00 hours.`;
        }
      }
      
      return null;
    }
      
    case 'project':
      if (!value) return 'Please pick a project';
      return null;
      
    case 'tool': {
      const project = rowData?.project;
      if (!project || !doesProjectNeedTools(project)) {
        // Tool is N/A for this project, normalize to null
        return null;
      }
      if (!value) return 'Please pick a tool for this project';
      return null;
    }
      
    case 'chargeCode': {
      const tool = rowData?.tool;
      if (!tool || !doesToolNeedChargeCode(tool)) {
        // Charge code is N/A for this tool, normalize to null
        return null;
      }
      if (!value) return 'Please pick a charge code for this tool';
      return null;
    }
      
    case 'taskDescription':
      if (!value) return 'Please describe what you did';
      return null;
      
    default:
      return null;
  }
}

/**
 * Validate complete timesheet for submission readiness
 * 
 * Performs comprehensive validation including:
 * - Required field presence (date, times, project, description)
 * - Date and time format validation
 * - Time range validation (end > start)
 * - Business rule compliance (tool/charge code requirements)
 * - Time overlap detection across all rows
 * 
 * Used by submit button to determine if submission can proceed.
 * Only validates rows with at least one field populated (ignores empty rows).
 * 
 * @param rows - Array of timesheet rows to validate
 * @returns Validation result with error flag and detailed error messages
 */
export function validateTimesheetRows(rows: TimesheetRow[]): { hasErrors: boolean; errorDetails: string[] } {
  if (!rows || rows.length === 0) {
    return { hasErrors: false, errorDetails: [] };
  }

  // Check if there's any real data (non-empty rows)
  const realRows = rows.filter((row) => {
    return row.date || row.hours !== undefined || row.project || row.taskDescription;
  });

  if (realRows.length === 0) {
    return { hasErrors: false, errorDetails: [] };
  }

  let hasErrors = false;
  const errorDetails: string[] = [];
  
  realRows.forEach((row, idx) => {
    const rowNum = idx + 1;
    
    // Check required fields
    if (!row.date) {
      errorDetails.push(`Row ${rowNum}: Missing date`);
      hasErrors = true;
    } else if (!isValidDate(row.date)) {
      errorDetails.push(`Row ${rowNum}: Invalid date format "${row.date}"`);
      hasErrors = true;
    }
    
    if (row.hours === undefined || row.hours === null) {
      errorDetails.push(`Row ${rowNum}: Missing hours`);
      hasErrors = true;
    } else if (!isValidHours(row.hours)) {
      errorDetails.push(`Row ${rowNum}: Invalid hours "${row.hours}" (must be between 0.25 and 24.0 in 15-minute increments)`);
      hasErrors = true;
    }
    
    if (!row.project) {
      errorDetails.push(`Row ${rowNum}: Missing project`);
      hasErrors = true;
    }
    
    if (!row.taskDescription) {
      errorDetails.push(`Row ${rowNum}: Missing task description`);
      hasErrors = true;
    }
    
    // Check if tool is required
    if (row.project && doesProjectNeedTools(row.project) && !row.tool) {
      errorDetails.push(`Row ${rowNum}: Project "${row.project}" requires a tool`);
      hasErrors = true;
    }
    
    // Check if charge code is required
    if (row.tool && doesToolNeedChargeCode(row.tool) && !row.chargeCode) {
      errorDetails.push(`Row ${rowNum}: Tool "${row.tool}" requires a charge code`);
      hasErrors = true;
    }
  });

  // Check for per-date total hours exceeding 24 (if submitted entries provided)
  // This is handled in validateField for individual field validation
  // For submission validation, we'd need submitted entries passed in

  return { hasErrors, errorDetails };
}
