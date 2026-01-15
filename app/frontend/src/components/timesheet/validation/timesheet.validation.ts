/**
 * @fileoverview Timesheet Validation
 *
 * Field-level validation logic for timesheet entries.
 * Validates individual fields and returns user-friendly error messages.
 * Used by Handsontable for inline validation during data entry.
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import {
  validateDateField,
  validateHoursField,
  validateProjectField,
  validateToolField,
  validateChargeCodeField,
  validateTaskDescriptionField,
} from "./timesheet.validation.field-helpers";
import { validateSingleRow } from "./timesheet.validation.row-helpers";

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
    case "date": {
      return validateDateField(value);
    }

    case "hours": {
      return validateHoursField(value, rowData, row, rows, submittedEntries);
    }

    case "project":
      return validateProjectField(value);

    case "tool": {
      return validateToolField(value, rowData);
    }

    case "chargeCode": {
      return validateChargeCodeField(value, rowData);
    }

    case "taskDescription":
      return validateTaskDescriptionField(value);

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
export function validateTimesheetRows(rows: TimesheetRow[]): {
  hasErrors: boolean;
  errorDetails: string[];
} {
  if (!rows || rows.length === 0) {
    return { hasErrors: false, errorDetails: [] };
  }

  // Check if there's any real data (non-empty rows)
  const realRows = rows.filter((row) => {
    return (
      row.date || row.hours !== undefined || row.project || row.taskDescription
    );
  });

  if (realRows.length === 0) {
    return { hasErrors: false, errorDetails: [] };
  }

  let hasErrors = false;
  const errorDetails: string[] = [];

  realRows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const rowHasErrors = validateSingleRow(row, rowNum, errorDetails);
    if (rowHasErrors) {
      hasErrors = true;
    }
  });

  // Check for per-date total hours exceeding 24 (if submitted entries provided)
  // This is handled in validateField for individual field validation
  // For submission validation, we'd need submitted entries passed in

  return { hasErrors, errorDetails };
}
