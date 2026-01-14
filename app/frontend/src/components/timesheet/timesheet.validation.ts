/**
 * @fileoverview Timesheet Validation
 * 
 * Field-level validation logic for timesheet entries.
 * Validates individual fields and returns user-friendly error messages.
 * Used by Handsontable for inline validation during data entry.
 */

import type { TimesheetRow } from './timesheet.schema';
import { isValidDate, isValidTime, isTimeOutAfterTimeIn, hasTimeOverlapWithPreviousEntries } from './timesheet.schema';
import { doesProjectNeedTools, doesToolNeedChargeCode } from '@sheetpilot/shared/business-config';
import { isDateInAllowedRange } from '@/utils/smartDate';

/**
 * Validate a single field value with context-aware rules
 * 
 * @param value - Field value to validate
 * @param row - Row index for context (overlap detection)
 * @param prop - Field name being validated
 * @param rows - All rows for overlap detection
 * @returns Error message if invalid, null if valid
 */
export function validateField(
  value: unknown, 
  row: number, 
  prop: string | number, 
  rows: TimesheetRow[]
): string | null {
  const rowData = rows[row];
  
  switch (prop) {
    case 'date': {
      if (!value) return 'Please enter a date';
      if (!isValidDate(String(value))) return 'Date must be like 01/15/2024';
      if (!isDateInAllowedRange(String(value))) return 'Date must be within allowed quarter range';
      return null;
    }
      
    case 'timeIn': {
      if (!value) return 'Please enter start time';
      if (!isValidTime(String(value))) return 'Time must be like 09:00, 800, or 1430 and in 15 minute steps';
      // Check for overlaps after updating the value
      const updatedRow = { ...rowData, timeIn: String(value) };
      const updatedRows = [...rows];
      updatedRows[row] = updatedRow;
      if (hasTimeOverlapWithPreviousEntries(row, updatedRows)) {
        return 'The time range you entered overlaps with a previous entry, please adjust your entry accordingly';
      }
      return null;
    }
      
    case 'timeOut': {
      if (!value) return 'Please enter end time';
      if (!isValidTime(String(value))) return 'Time must be like 17:00, 1700, or 530 and in 15 minute steps';
      if (!isTimeOutAfterTimeIn(rowData?.timeIn, String(value))) return 'End time must be after start time';
      // Check for overlaps after updating the value
      const updatedRow = { ...rowData, timeOut: String(value) };
      const updatedRows = [...rows];
      updatedRows[row] = updatedRow;
      if (hasTimeOverlapWithPreviousEntries(row, updatedRows)) {
        return 'The time range you entered overlaps with a previous entry, please adjust your entry accordingly';
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
    return row.date || row.timeIn || row.timeOut || row.project || row.taskDescription;
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
    
    if (!row.timeIn) {
      errorDetails.push(`Row ${rowNum}: Missing start time`);
      hasErrors = true;
    } else if (!isValidTime(row.timeIn)) {
      errorDetails.push(`Row ${rowNum}: Invalid start time "${row.timeIn}" (must be HH:MM in 15-min increments)`);
      hasErrors = true;
    }
    
    if (!row.timeOut) {
      errorDetails.push(`Row ${rowNum}: Missing end time`);
      hasErrors = true;
    } else if (!isValidTime(row.timeOut)) {
      errorDetails.push(`Row ${rowNum}: Invalid end time "${row.timeOut}" (must be HH:MM in 15-min increments)`);
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

  // Check for time overlaps
  rows.forEach((row, idx) => {
    if (!hasTimeOverlapWithPreviousEntries(idx, rows)) return;
    errorDetails.push(`Row ${idx + 1}: Time overlap detected on ${row.date}`);
    hasErrors = true;
  });

  return { hasErrors, errorDetails };
}
