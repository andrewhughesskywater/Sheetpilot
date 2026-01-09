/**
 * @fileoverview Timesheet Normalization Logic
 * 
 * Pure functions for normalizing timesheet data.
 * Extracted from TimesheetGrid component for reusability.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

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

/**
 * Normalize a timesheet row based on business rules
 * - Clear tool/charge code if project doesn't need them
 * - Clear charge code if tool doesn't need it
 */
export function normalizeRowData(row: TimesheetRow): TimesheetRow {
  const normalized = { ...row };
  if (!projectNeedsTools(normalized.project)) {
    normalized.tool = null;
    normalized.chargeCode = null;
  }
  if (!toolNeedsChargeCode(normalized.tool || undefined)) {
    normalized.chargeCode = null;
  }
  return normalized;
}

function isRowEmpty(row: TimesheetRow | undefined): boolean {
  if (!row) return true;
  return !(row.date || row.timeIn || row.timeOut || row.project || row.tool || row.chargeCode || row.taskDescription);
}

function findLastNonEmptyRowIndex(rows: TimesheetRow[]): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!isRowEmpty(rows[i])) {
      return i;
    }
  }
  return -1;
}

/**
 * Ensure one blank row at end for new entries
 * Removes trailing empty rows and adds exactly one blank row
 */
export function normalizeTrailingBlank(rows: TimesheetRow[]): TimesheetRow[] {
  // Remove trailing empty rows
  const lastNonEmptyIndex = findLastNonEmptyRowIndex(rows);
  
  // Get rows up to last non-empty, then add one blank row
  const trimmedRows = rows.slice(0, lastNonEmptyIndex + 1);
  trimmedRows.push({});
  return trimmedRows;
}

