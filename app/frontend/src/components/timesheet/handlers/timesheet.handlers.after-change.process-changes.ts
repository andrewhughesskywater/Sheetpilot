/**
 * Helper functions for processing changes in after change handler
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type {
  HandsontableChange,
  ValidationError,
} from "@/components/timesheet/cell-processing/timesheet.cell-processing";

export { processCellChanges } from "./timesheet.handlers.after-change.process-changes.process-single";

export function updateValidationErrors(
  cellsToClearErrors: Array<{ row: number; col: number }>,
  newErrors: ValidationError[],
  prevErrors: ValidationError[]
): ValidationError[] {
  let filtered = prevErrors;

  if (cellsToClearErrors.length > 0) {
    filtered = filtered.filter(
      (prevErr) =>
        !cellsToClearErrors.some(
          (clear) => clear.row === prevErr.row && clear.col === prevErr.col
        )
    );
  }

  if (newErrors.length > 0) {
    filtered = filtered.filter(
      (prevErr) =>
        !newErrors.some(
          (newErr) =>
            newErr.row === prevErr.row && newErr.col === prevErr.col
        )
    );
  }

  return [...filtered, ...newErrors];
}

export function addClearedRowsToCellsToClear(
  cellsToClearErrors: Array<{ row: number; col: number }>,
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
  },
  overlapClearedRows: number[],
  timeOutClearedRows: number[]
): void {
  const dateColIdx = hotInstance.propToCol("date");
  if (typeof dateColIdx === "number" && dateColIdx >= 0) {
    for (const rowIdx of overlapClearedRows) {
      cellsToClearErrors.push({ row: rowIdx, col: dateColIdx });
    }
  }

  const timeOutColIdxForClearing = hotInstance.propToCol("timeOut");
  if (
    typeof timeOutColIdxForClearing === "number" &&
    timeOutColIdxForClearing >= 0
  ) {
    for (const rowIdx of timeOutClearedRows) {
      cellsToClearErrors.push({ row: rowIdx, col: timeOutColIdxForClearing });
    }
  }
}
