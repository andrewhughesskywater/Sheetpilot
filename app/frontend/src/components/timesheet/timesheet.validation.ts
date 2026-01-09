/**
 * @fileoverview Timesheet Validation
 *
 * Field-level validation logic for timesheet entries.
 * Validates individual fields and returns user-friendly error messages.
 * Used by Handsontable for inline validation during data entry.
 */

import { doesProjectNeedTools, doesToolNeedChargeCode } from '@sheetpilot/shared/business-config';

import { isDateInAllowedRange } from '../../utils/smartDate';
import type { TimesheetRow } from './timesheet.schema';
import { hasTimeOverlapWithPreviousEntries,isTimeOutAfterTimeIn, isValidDate, isValidTime } from './timesheet.schema';

/**
 * Validate date field
 */
function validateDateFieldFrontend(value: unknown): string | null {
  if (!value) return 'Please enter a date';
  const dateStr = String(value);
  if (!isValidDate(dateStr)) return 'Date must be like 01/15/2024';
  if (!isDateInAllowedRange(dateStr)) return 'Date must be within allowed quarter range';
  return null;
}

/**
 * Check for time overlap in updated rows
 */
function checkTimeOverlap(row: number, updatedRows: TimesheetRow[]): string | null {
  if (hasTimeOverlapWithPreviousEntries(row, updatedRows)) {
    return 'The time range you entered overlaps with a previous entry, please adjust your entry accordingly';
  }
  return null;
}

/**
 * Validate timeIn field with overlap checking
 */
function validateTimeInFieldFrontend(
  value: unknown,
  row: number,
  rowData: TimesheetRow,
  rows: TimesheetRow[]
): string | null {
  if (!value) return 'Please enter start time';
  if (!isValidTime(String(value))) return 'Time must be like 09:00, 800, or 1430 and in 15 minute steps';

  // Check for overlaps after updating the value
  const updatedRow = { ...rowData, timeIn: String(value) };
  const updatedRows = [...rows];
  updatedRows[row] = updatedRow;
  return checkTimeOverlap(row, updatedRows);
}

/**
 * Validate timeOut field with overlap checking
 */
function validateTimeOutFieldFrontend(
  value: unknown,
  row: number,
  rowData: TimesheetRow,
  rows: TimesheetRow[]
): string | null {
  if (!value) return 'Please enter end time';
  if (!isValidTime(String(value))) return 'Time must be like 17:00, 1700, or 530 and in 15 minute steps';
  if (!isTimeOutAfterTimeIn(rowData?.timeIn, String(value))) return 'End time must be after start time';

  // Check for overlaps after updating the value
  const updatedRow = { ...rowData, timeOut: String(value) };
  const updatedRows = [...rows];
  updatedRows[row] = updatedRow;
  return checkTimeOverlap(row, updatedRows);
}

/**
 * Validate tool field
 */
function validateToolFieldFrontend(value: unknown, project?: string): string | null {
  if (!project || !doesProjectNeedTools(project)) {
    // Tool is N/A for this project, normalize to null
    return null;
  }
  if (!value) return 'Please pick a tool for this project';
  return null;
}

/**
 * Validate chargeCode field
 */
function validateChargeCodeFieldFrontend(value: unknown, tool?: string): string | null {
  if (!tool || !doesToolNeedChargeCode(tool)) {
    // Charge code is N/A for this tool, normalize to null
    return null;
  }
  if (!value) return 'Please pick a charge code for this tool';
  return null;
}

/**
 * Validate a single field value with context-aware rules
 *
 * @param value - Field value to validate
 * @param row - Row index for context (overlap detection)
 * @param prop - Field name being validated
 * @param rows - All rows for overlap detection
 * @returns Error message if invalid, null if valid
 */
export function validateField(value: unknown, row: number, prop: string | number, rows: TimesheetRow[]): string | null {
  const rowData = rows[row];

  switch (prop) {
    case 'date':
      return validateDateFieldFrontend(value);

    case 'timeIn':
      return validateTimeInFieldFrontend(value, row, rowData, rows);

    case 'timeOut':
      return validateTimeOutFieldFrontend(value, row, rowData, rows);

    case 'project':
      if (!value) return 'Please pick a project';
      return null;

    case 'tool':
      return validateToolFieldFrontend(value, rowData?.project);

    case 'chargeCode':
      return validateChargeCodeFieldFrontend(value, rowData?.tool);

    case 'taskDescription':
      if (!value) return 'Please describe what you did';
      return null;

    default:
      return null;
  }
}
