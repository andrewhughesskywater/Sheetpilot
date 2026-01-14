/**
 * Helper functions for macro operations
 */

import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';
import type { MacroRow } from '@/utils/macroStorage';

/**
 * Find target row for macro application
 */
export function findMacroTargetRow(
  selected: number[][] | undefined,
  sourceData: TimesheetRow[]
): number {
  if (selected && selected.length > 0) {
    const firstSelection = selected[0];
    if (firstSelection && typeof firstSelection[0] === 'number') {
      return firstSelection[0];
    }
  }
  
  const emptyRowIndex = sourceData.findIndex(row => 
    !row.date && !row.timeIn && !row.timeOut && !row.project && !row.taskDescription
  );
  if (emptyRowIndex >= 0) {
    return emptyRowIndex;
  }
  
  return sourceData.length;
}

/**
 * Apply macro values to row
 */
export function applyMacroToRow(
  row: TimesheetRow,
  macro: MacroRow
): TimesheetRow {
  const updatedRow: TimesheetRow = { ...row };
  if (macro.timeIn) updatedRow.timeIn = macro.timeIn;
  if (macro.timeOut) updatedRow.timeOut = macro.timeOut;
  if (macro.project) updatedRow.project = macro.project;
  if (macro.tool !== undefined) updatedRow.tool = macro.tool;
  if (macro.chargeCode !== undefined) updatedRow.chargeCode = macro.chargeCode;
  if (macro.taskDescription) updatedRow.taskDescription = macro.taskDescription;
  return updatedRow;
}
