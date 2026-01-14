/**
 * Helper functions for after change handler
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { ValidationError } from "@/components/timesheet/cell-processing/timesheet.cell-processing";

export function markOverlapError(
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
    setCellMeta: (
      row: number,
      col: number,
      key: string,
      value: unknown
    ) => void;
  },
  row: TimesheetRow,
  rowIndex: number,
  dateColIdx: number | unknown,
  timeInColIdx: number | unknown,
  timeOutColIdx: number | unknown
): ValidationError | null {
  [dateColIdx, timeInColIdx, timeOutColIdx].forEach((colIdx) => {
    if (typeof colIdx === "number" && colIdx >= 0) {
      hotInstance.setCellMeta(rowIndex, colIdx, "className", "htInvalid");
    }
  });

  if (typeof dateColIdx === "number" && dateColIdx >= 0) {
    return {
      row: rowIndex,
      col: dateColIdx,
      field: "date",
      message: `Time overlap detected on ${row.date || "this date"}`,
    };
  }
  return null;
}

export function clearOverlapStyling(
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
    getCellMeta: (row: number, col: number) => { className?: string | string[] };
    setCellMeta: (
      row: number,
      col: number,
      key: string,
      value: unknown
    ) => void;
  },
  rowIndex: number,
  dateColIdx: number | unknown,
  timeInColIdx: number | unknown,
  timeOutColIdx: number | unknown
): void {
  [dateColIdx, timeInColIdx, timeOutColIdx].forEach((colIdx) => {
    if (typeof colIdx === "number" && colIdx >= 0) {
      const rawClass = hotInstance.getCellMeta(rowIndex, colIdx).className;
      const currentClass = Array.isArray(rawClass)
        ? rawClass.join(" ")
        : rawClass || "";
      if (currentClass.includes("htInvalid")) {
        hotInstance.setCellMeta(
          rowIndex,
          colIdx,
          "className",
          currentClass.replace("htInvalid", "").trim()
        );
      }
    }
  });
}

export { validateTimeOverlaps } from "./timesheet.handlers.after-change.helpers.validate-overlap";

export function markTimeOutError(
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
    setCellMeta: (
      row: number,
      col: number,
      key: string,
      value: unknown
    ) => void;
  },
  row: TimesheetRow,
  rowIndex: number,
  timeOutColIdx: number | unknown
): ValidationError | null {
  if (typeof timeOutColIdx === "number" && timeOutColIdx >= 0) {
    hotInstance.setCellMeta(rowIndex, timeOutColIdx, "className", "htInvalid");
    return {
      row: rowIndex,
      col: timeOutColIdx,
      field: "timeOut",
      message: `End time ${row.timeOut} must be after start time ${row.timeIn}`,
    };
  }
  return null;
}

export function clearTimeOutError(
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
    getCellMeta: (row: number, col: number) => { className?: string | string[] };
    setCellMeta: (
      row: number,
      col: number,
      key: string,
      value: unknown
    ) => void;
  },
  rowIndex: number,
  timeOutColIdx: number | unknown
): boolean {
  if (typeof timeOutColIdx === "number" && timeOutColIdx >= 0) {
    const rawClass = hotInstance.getCellMeta(rowIndex, timeOutColIdx).className;
    const currentClass = Array.isArray(rawClass)
      ? rawClass.join(" ")
      : rawClass || "";
    if (currentClass.includes("htInvalid")) {
      hotInstance.setCellMeta(
        rowIndex,
        timeOutColIdx,
        "className",
        currentClass.replace("htInvalid", "").trim()
      );
    }
    return true;
  }
  return false;
}

export { validateTimeOutAfterTimeIn } from "./timesheet.handlers.after-change.helpers.validate-timeout";

export function scheduleRowSaves(
  changes: Array<[number, string | number, unknown, unknown]>,
  normalized: TimesheetRow[],
  saveTimersRef: {
    get: (key: number) => ReturnType<typeof setTimeout> | undefined;
    set: (key: number, value: ReturnType<typeof setTimeout>) => void;
  },
  saveAndReloadRow: (row: TimesheetRow, rowIdx: number) => Promise<void>
): void {
  const DEBOUNCE_DELAY = 500;
  for (const change of changes) {
    const [rowIdx] = change;
    const row = normalized[rowIdx];
    if (!row) continue;

    // Note: We no longer skip saving overlapping rows - the validation error
    // will still show and prevent submission, but data will be persisted

    const hasAnyData =
      row.date ||
      row.timeIn ||
      row.timeOut ||
      row.project ||
      row.taskDescription;
    if (hasAnyData) {
      const existingTimer = saveTimersRef.get(rowIdx);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timer = setTimeout(() => {
        void (async () => {
          window.logger?.verbose("[TimesheetGrid] Saving individual row", {
            rowIdx,
          });
          await saveAndReloadRow(row, rowIdx);
          saveTimersRef.delete(rowIdx);
        })();
      }, DEBOUNCE_DELAY);

      saveTimersRef.set(rowIdx, timer);
    }
  }
}
