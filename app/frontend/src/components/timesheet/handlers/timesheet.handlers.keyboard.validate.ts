/**
 * Helper functions for validating keyboard input
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";

export function validateKeyboardInput(
  hotInstance: {
    getSelected: () => Array<[number, number]> | null;
  },
  timesheetDraftData: TimesheetRow[]
): {
  isValid: boolean;
  row: number;
  col: number;
  rowData: TimesheetRow | null;
} {
  const selected = hotInstance.getSelected();
  if (!selected || selected.length === 0) {
    return { isValid: false, row: -1, col: -1, rowData: null };
  }

  const firstSelection = selected[0];
  if (!firstSelection) {
    return { isValid: false, row: -1, col: -1, rowData: null };
  }

  const [row, col] = firstSelection;
  if (typeof row !== "number" || typeof col !== "number") {
    return { isValid: false, row: -1, col: -1, rowData: null };
  }

  // Only handle date column (column 1, after hidden ID column)
  if (col !== 1) {
    return { isValid: false, row: -1, col: -1, rowData: null };
  }

  const rowData = timesheetDraftData[row];
  if (!rowData) {
    return { isValid: false, row: -1, col: -1, rowData: null };
  }

  return { isValid: true, row, col, rowData };
}
