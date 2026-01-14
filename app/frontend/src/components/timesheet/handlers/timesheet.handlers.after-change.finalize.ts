/**
 * Helper functions for finalizing after change handler
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { HandsontableChange } from "@/components/timesheet/cell-processing/timesheet.cell-processing";
import type { ButtonStatus } from "./timesheet.handlers.after-change";

export function updateUnsavedRows(
  changes: HandsontableChange[],
  normalized: TimesheetRow[],
  unsavedRowsRef: {
    current: {
      set: (key: number, value: TimesheetRow) => void;
    };
  }
): void {
  for (const change of changes) {
    const [rowIdx] = change;
    if (normalized[rowIdx]) {
      unsavedRowsRef.current.set(rowIdx, normalized[rowIdx]);
    }
  }
}

export function updateSaveButtonState(
  changes: HandsontableChange[],
  setSaveButtonState: (state: ButtonStatus) => void
): void {
  if (changes.length > 0) {
    setSaveButtonState("save");
  }
}
