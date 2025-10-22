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

/**
 * Ensure one blank row at end for new entries
 * Removes trailing empty rows and adds exactly one blank row
 */
export function normalizeTrailingBlank(rows: TimesheetRow[]): TimesheetRow[] {
  // Remove trailing empty rows
  let lastNonEmptyIndex = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row?.date || row?.timeIn || row?.timeOut || row?.project || row?.tool || row?.chargeCode || row?.taskDescription) {
      lastNonEmptyIndex = i;
      break;
    }
  }
  return rows.slice(0, lastNonEmptyIndex + 2); // Keep one blank row at the end
}

