/**
 * Helper functions for processing changes in after change handler
 */

import type { ValidationError } from "@/components/timesheet/cell-processing/timesheet.cell-processing";

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
          (newErr) => newErr.row === prevErr.row && newErr.col === prevErr.col
        )
    );
  }

  return [...filtered, ...newErrors];
}

// Removed overlap and timeOut validation clearing - no longer needed
