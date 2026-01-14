/**
 * Helper functions for validating timeOut after timeIn
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { ValidationError } from "@/components/timesheet/cell-processing/timesheet.cell-processing";
import {
  markTimeOutError,
  clearTimeOutError,
} from "./timesheet.handlers.after-change.helpers";

function processTimeOutRow(
  row: TimesheetRow,
  rowIndex: number,
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
  isTimeOutAfterTimeInFn: (timeIn?: string, timeOut?: string) => boolean
): {
  error: ValidationError | null;
  cleared: boolean;
} {
  const timeOutColIdx = hotInstance.propToCol("timeOut");

  if (!isTimeOutAfterTimeInFn(row.timeIn, row.timeOut)) {
    const error = markTimeOutError(hotInstance, row, rowIndex, timeOutColIdx);
    return { error, cleared: false };
  } else {
    const cleared = clearTimeOutError(hotInstance, rowIndex, timeOutColIdx);
    return { error: null, cleared };
  }
}

export function validateTimeOutAfterTimeIn(
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
  isTimeOutAfterTimeInFn: (timeIn?: string, timeOut?: string) => boolean
): {
  timeOutErrors: ValidationError[];
  timeOutClearedRows: number[];
} {
  const timeOutErrors: ValidationError[] = [];
  const timeOutClearedRows: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const row = normalized[i];
    if (!row) continue;

    if (row.timeIn && row.timeOut) {
      const result = processTimeOutRow(
        row,
        i,
        hotInstance,
        isTimeOutAfterTimeInFn
      );
      if (result.error) {
        timeOutErrors.push(result.error);
      }
      if (result.cleared) {
        timeOutClearedRows.push(i);
      }
    }
  }
  return { timeOutErrors, timeOutClearedRows };
}
