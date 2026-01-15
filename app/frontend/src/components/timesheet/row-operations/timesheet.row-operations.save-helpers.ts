/**
 * Helper functions for save and reload operations
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { MutableRefObject } from "react";
import type { HotTableRef } from "@handsontable/react-wrapper";
import type { saveRowToDatabase } from "@/components/timesheet/persistence/timesheet.persistence";
import {
  checkRowFieldsMatch,
  rowNeedsUpdate,
} from "./timesheet.row-operations.helpers";

/**
 * Setup abort controller for save operation
 */
export function setupSaveAbortController(
  inFlightSavesRef: MutableRefObject<Map<number, AbortController>>,
  rowIdx: number
): AbortController {
  const existingController = inFlightSavesRef.current.get(rowIdx);
  if (existingController) {
    existingController.abort();
    window.logger?.debug("Cancelled previous save operation for row", {
      rowIdx,
    });
  }

  const abortController = new AbortController();
  inFlightSavesRef.current.set(rowIdx, abortController);
  return abortController;
}

/**
 * Handle successful save result
 */
export function handleSuccessfulSave(
  savedEntry: TimesheetRow,
  hotInstance: NonNullable<HotTableRef["hotInstance"]>,
  rowIdx: number,
  currentData: TimesheetRow[],
  currentRow: TimesheetRow,
  unsavedRowsRef: MutableRefObject<Map<number, TimesheetRow>>,
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  onChange: ((rows: TimesheetRow[]) => void) | undefined
): void {
  const fieldsMatch = checkRowFieldsMatch(currentRow, savedEntry);

  if (fieldsMatch) {
    unsavedRowsRef.current.delete(rowIdx);
    window.logger?.verbose("Row synced successfully", {
      id: savedEntry.id,
      rowIdx,
    });
  } else {
    window.logger?.debug("Row values changed during save (race condition)", {
      rowIdx,
      saved: savedEntry,
      current: currentRow,
    });
  }

  const needsUpdate = rowNeedsUpdate(currentRow, savedEntry);

  if (needsUpdate) {
    const updatedData = [...currentData];
    updatedData[rowIdx] = { ...currentRow, ...savedEntry };

    setTimesheetDraftData(updatedData);
    onChange?.(updatedData);

    window.logger?.verbose("Row saved and state updated", {
      id: savedEntry.id,
      rowIdx,
    });
  }
}

/**
 * Process save result and update row state
 */
export async function processSaveResult(
  saveResult: Awaited<ReturnType<typeof saveRowToDatabase>>,
  abortController: AbortController,
  rowIdx: number,
  hotTableRef: MutableRefObject<HotTableRef | null>,
  unsavedRowsRef: MutableRefObject<Map<number, TimesheetRow>>,
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  onChange: ((rows: TimesheetRow[]) => void) | undefined
): Promise<void> {
  if (abortController.signal.aborted) {
    window.logger?.debug("Save operation aborted", { rowIdx });
    return;
  }

  if (saveResult.success && saveResult.entry) {
    const savedEntry = saveResult.entry;
    const hotInstance = hotTableRef.current?.hotInstance;
    if (hotInstance) {
      const currentData = hotInstance.getSourceData() as TimesheetRow[];
      const currentRow = currentData[rowIdx];

      if (!currentRow) {
        window.logger?.warn("Current row not found for receipt check", {
          rowIdx,
        });
        unsavedRowsRef.current.delete(rowIdx);
        return;
      }

      handleSuccessfulSave(
        savedEntry,
        hotInstance,
        rowIdx,
        currentData,
        currentRow,
        unsavedRowsRef,
        setTimesheetDraftData,
        onChange
      );
    }
  } else {
    window.logger?.warn("Could not save row to database", {
      error: saveResult.error,
      rowIdx,
    });
  }
}

/**
 * Cleanup save operation state
 */
export function cleanupSaveOperation(
  rowIdx: number,
  pendingSaveRef: MutableRefObject<Map<number, TimesheetRow>>,
  inFlightSavesRef: MutableRefObject<Map<number, AbortController>>,
  updateSaveButtonState: () => void
): void {
  pendingSaveRef.current.delete(rowIdx);
  inFlightSavesRef.current.delete(rowIdx);
  updateSaveButtonState();
}

/**
 * Handle save operation error
 */
export function handleSaveError(
  error: unknown,
  rowIdx: number,
  abortController: AbortController,
  pendingSaveRef: MutableRefObject<Map<number, TimesheetRow>>,
  inFlightSavesRef: MutableRefObject<Map<number, AbortController>>,
  updateSaveButtonState: () => void
): void {
  if (abortController.signal.aborted) {
    return;
  }

  window.logger?.error("Encountered error saving and reloading row", {
    rowIdx,
    error: error instanceof Error ? error.message : String(error),
  });
  pendingSaveRef.current.delete(rowIdx);
  inFlightSavesRef.current.delete(rowIdx);

  updateSaveButtonState();
}
