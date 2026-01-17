/**
 * Event handlers for timesheet grid
 *
 * Factory functions that create event handlers for Handsontable and other UI interactions.
 * All handlers maintain exact signatures and behavior from the original component.
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { MutableRefObject } from "react";
import type { HotTableRef } from "@handsontable/react-wrapper";
import { createHandleAfterChange, type ButtonStatus } from "./timesheet.handlers.after-change";
import { createHandleAfterRemoveRow } from "./timesheet.handlers.remove-row";
import { createHandleSubmitTimesheet } from "./timesheet.handlers.submit";
import { createHandleBeforeKeyDown } from "./timesheet.handlers.keyboard";
import { createHandleAfterSelection } from "./timesheet.handlers.selection";
import { createHandleRefresh } from "./timesheet.handlers.refresh";

export { createHandleAfterChange };
export { createHandleAfterRemoveRow };
export { createHandleSubmitTimesheet };
export { createHandleBeforeKeyDown };
export { createHandleAfterSelection };
export { createHandleRefresh };
export type { ButtonStatus };

/**
 * Create handle after paste callback
 */
export function createHandleAfterPaste(
  hotTableRef: MutableRefObject<HotTableRef | null>,
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  onChange: ((rows: TimesheetRow[]) => void) | undefined,
  saveTimersRef: MutableRefObject<Map<number, ReturnType<typeof setTimeout>>>,
  pendingSaveRef: MutableRefObject<Map<number, TimesheetRow>>,
  saveAndReloadRow: (row: TimesheetRow, rowIdx: number) => Promise<void>,
  applyPastedToolAndChargeCodeFn: (
    data: unknown[][],
    startRow: number,
    startCol: number,
    hotInstance: {
      propToCol: (prop: string) => number | unknown;
      setCellMeta: (
        row: number,
        col: number,
        key: string,
        value: unknown
      ) => void;
      setDataAtCell: (
        row: number,
        col: number,
        value: unknown,
        source?: string
      ) => void;
    }
  ) => void,
  normalizePastedRowsFn: (
    pastedRowIndices: number[],
    currentData: TimesheetRow[],
    hotInstance: {
      propToCol: (prop: string) => number | unknown;
      setDataAtCell: (
        row: number,
        col: number,
        value: unknown,
        source?: string
      ) => void;
      render: () => void;
    },
    normalizeRowDataFn: (
      row: TimesheetRow,
      projectNeedsTools: (p?: string) => boolean,
      toolNeedsChargeCode: (t?: string) => boolean
    ) => TimesheetRow,
    projectNeedsToolsWrapper: (p?: string) => boolean,
    toolNeedsChargeCodeWrapper: (t?: string) => boolean
  ) => { updatedData: TimesheetRow[]; hasChanges: boolean },
  savePastedRowsFn: (
    pastedRowIndices: number[],
    normalizedData: TimesheetRow[],
    saveTimersRef: MutableRefObject<Map<number, ReturnType<typeof setTimeout>>>,
    pendingSaveRef: MutableRefObject<Map<number, TimesheetRow>>,
    saveAndReloadRow: (row: TimesheetRow, rowIdx: number) => Promise<void>
  ) => void,
  normalizeRowDataFn: (
    row: TimesheetRow,
    projectNeedsTools: (p?: string) => boolean,
    toolNeedsChargeCode: (t?: string) => boolean
  ) => TimesheetRow,
  projectNeedsToolsWrapper: (p?: string) => boolean,
  toolNeedsChargeCodeWrapper: (t?: string) => boolean
): (
  data: unknown[][],
  coords: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  }[]
) => void {
  return (
    data: unknown[][],
    coords: {
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    }[]
  ) => {
    if (!coords || coords.length === 0) return;

    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    const firstCoord = coords[0];
    if (!firstCoord) return;
    const { startRow, startCol } = firstCoord;

    // First, manually apply Tool and Charge Code from pasted data
    applyPastedToolAndChargeCodeFn(data, startRow, startCol, hotInstance);

    // Wait for Handsontable to finish processing the paste, then normalize and validate
    setTimeout(() => {
      const hotInstanceAfterPaste = hotTableRef.current?.hotInstance;
      if (!hotInstanceAfterPaste) return;

      const currentData =
        hotInstanceAfterPaste.getSourceData() as TimesheetRow[];
      const pastedRowIndices: number[] = [];

      // Collect all pasted row indices
      for (
        let i = startRow;
        i <= startRow + data.length - 1 && i < currentData.length;
        i++
      ) {
        if (i >= 0) {
          pastedRowIndices.push(i);
        }
      }

      // Normalize each pasted row
      const { updatedData, hasChanges } = normalizePastedRowsFn(
        pastedRowIndices,
        currentData,
        hotInstanceAfterPaste,
        normalizeRowDataFn,
        projectNeedsToolsWrapper,
        toolNeedsChargeCodeWrapper
      );

      // Update state if normalization changed anything
      if (hasChanges) {
        setTimesheetDraftData(updatedData);
        onChange?.(updatedData);
        // WHY: Removed manual render() call - Handsontable's React wrapper will re-render
        // when data prop changes. Calling render() here can cause infinite update loops.
      }

      // Now save all complete pasted rows immediately
      const normalizedData = updatedData.map((row) =>
        normalizeRowDataFn(
          row,
          projectNeedsToolsWrapper,
          toolNeedsChargeCodeWrapper
        )
      );

      savePastedRowsFn(
        pastedRowIndices,
        normalizedData,
        saveTimersRef,
        pendingSaveRef,
        saveAndReloadRow
      );
    }, 100);
  };
}

/**
 * Create handle stop submission function
 */
export function createHandleStopSubmission(
  isProcessingRef: MutableRefObject<boolean>,
  setIsProcessing: (value: boolean) => void,
  refreshTimesheetDraft: () => Promise<void>,
  refreshArchiveData: () => Promise<void>,
  cancelTimesheetSubmissionFn: () => Promise<{
    success: boolean;
    error?: string;
  }>,
  logInfoFn: (message: string, meta?: Record<string, unknown>) => void,
  logWarnFn: (message: string, meta?: Record<string, unknown>) => void,
  logErrorFn: (message: string, meta?: Record<string, unknown>) => void
): () => Promise<void> {
  return async () => {
    logInfoFn("Stop button clicked");

    if (!isProcessingRef.current) {
      logWarnFn("Stop ignored - no submission in progress");
      return;
    }

    try {
      const result = await cancelTimesheetSubmissionFn();
      if (result.success) {
        logInfoFn("Submission cancelled successfully");
        window.alert(
          "⏹️ Submission cancelled. Entries have been reset to pending status."
        );

        // Reset processing state
        isProcessingRef.current = false;
        setIsProcessing(false);

        // Refresh data to show updated status
        await refreshTimesheetDraft();
        await refreshArchiveData();
      } else {
        logWarnFn("Could not cancel submission", { error: result.error });
        window.alert(
          `⚠️ Could not cancel submission: ${result.error || "Unknown error"}`
        );
      }
    } catch (error) {
      logErrorFn("Unexpected error during cancellation", {
        error: error instanceof Error ? error.message : String(error),
      });
      window.alert(
        `❌ Unexpected error during cancellation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}

/**
 * Create handle manual save function
 */
export function createHandleManualSave(
  saveButtonState: ButtonStatus,
  unsavedRowsRef: MutableRefObject<Map<number, TimesheetRow>>,
  saveStartTimeRef: MutableRefObject<number | null>,
  setSaveButtonState: (state: ButtonStatus) => void,
  saveAndReloadRow: (row: TimesheetRow, rowIdx: number) => Promise<void>,
  updateSaveButtonState: () => void
): () => Promise<void> {
  return async () => {
    if (saveButtonState !== "save") return;

    const unsavedRows = Array.from(unsavedRowsRef.current.entries());
    if (unsavedRows.length === 0) return;

    // Set saving state
    if (saveStartTimeRef.current === null) {
      saveStartTimeRef.current = Date.now();
    }
    setSaveButtonState("saving");

    // Save all unsaved rows individually to get receipt checks
    const savePromises = unsavedRows.map(([rowIdx, row]) =>
      saveAndReloadRow(row, rowIdx).catch((error) => {
        window.logger?.error("Could not save row during manual save", {
          rowIdx,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );

    await Promise.all(savePromises);

    // Update button state (with minimum duration enforcement)
    updateSaveButtonState();
  };
}
