/**
 * Helper functions for validating time overlaps
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { ValidationError } from "@/components/timesheet/cell-processing/timesheet.cell-processing";
import {
  markOverlapError,
  clearOverlapStyling,
} from "./timesheet.handlers.after-change.helpers";

function processOverlapRow(
  row: TimesheetRow,
  rowIndex: number,
  normalized: TimesheetRow[],
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
    setCellMeta: (
      row: number,
      col: number,
      key: string,
      value: unknown
    ) => void;
    getCellMeta: (row: number, col: number) => { className?: string | string[] };
  },
  hasTimeOverlapWithPreviousEntriesFn: (
    rowIndex: number,
    rows: TimesheetRow[]
  ) => boolean
): {
  error: ValidationError | null;
  cleared: boolean;
} {
  const hasOverlap = hasTimeOverlapWithPreviousEntriesFn(rowIndex, normalized);
  const dateColIdx = hotInstance.propToCol("date");
  const timeInColIdx = hotInstance.propToCol("timeIn");
  const timeOutColIdx = hotInstance.propToCol("timeOut");

  if (hasOverlap) {
    const error = markOverlapError(
      hotInstance,
      row,
      rowIndex,
      dateColIdx,
      timeInColIdx,
      timeOutColIdx
    );
    return { error, cleared: false };
  } else {
    clearOverlapStyling(hotInstance, rowIndex, dateColIdx, timeInColIdx, timeOutColIdx);
    return { error: null, cleared: true };
  }
}

export function validateTimeOverlaps(
  normalized: TimesheetRow[],
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
    setCellMeta: (
      row: number,
      col: number,
      key: string,
      value: unknown
    ) => void;
    getCellMeta: (row: number, col: number) => { className?: string | string[] };
  },
  hasTimeOverlapWithPreviousEntriesFn: (
    rowIndex: number,
    rows: TimesheetRow[]
  ) => boolean
): {
  overlapErrors: ValidationError[];
  overlapClearedRows: number[];
} {
  const overlapErrors: ValidationError[] = [];
  const overlapClearedRows: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const row = normalized[i];
    if (!row) continue;

    if (row.date && row.timeIn && row.timeOut) {
      const result = processOverlapRow(
        row,
        i,
        normalized,
        hotInstance,
        hasTimeOverlapWithPreviousEntriesFn
      );
      if (result.error) {
        overlapErrors.push(result.error);
      }
      if (result.cleared) {
        overlapClearedRows.push(i);
      }
    }
  }
  return { overlapErrors, overlapClearedRows };
}
