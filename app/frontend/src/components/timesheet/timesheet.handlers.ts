/**
 * Event handlers for timesheet grid
 *
 * Factory functions that create event handlers for Handsontable and other UI interactions.
 * All handlers maintain exact signatures and behavior from the original component.
 */

import type { TimesheetRow } from "./timesheet.schema";
import type { MutableRefObject } from "react";
import type { HotTableRef } from "@handsontable/react-wrapper";
import type {
  HandsontableChange,
  ValidationError,
} from "./timesheet.cell-processing";
import { deleteDraftRows } from "./timesheet.persistence";

type ButtonStatus = "saved" | "saving" | "save";

/**
 * Create handle after change callback
 */
export function createHandleAfterChange(
  hotTableRef: MutableRefObject<HotTableRef | null>,
  timesheetDraftData: TimesheetRow[],
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  onChange: ((rows: TimesheetRow[]) => void) | undefined,
  isProcessingChangeRef: MutableRefObject<boolean>,
  saveAndReloadRow: (row: TimesheetRow, rowIdx: number) => Promise<void>,
  setValidationErrors: (
    updater: (prev: ValidationError[]) => ValidationError[]
  ) => void,
  setSaveButtonState: (state: ButtonStatus) => void,
  unsavedRowsRef: MutableRefObject<Map<number, TimesheetRow>>,
  saveTimersRef: MutableRefObject<Map<number, ReturnType<typeof setTimeout>>>,
  processCellChangeFn: (
    change: HandsontableChange,
    currentRow: TimesheetRow,
    hotInstance: {
      propToCol: (prop: string) => number | unknown;
      setDataAtCell: (
        row: number,
        col: number,
        value: unknown,
        source?: string
      ) => void;
      setCellMeta: (
        row: number,
        col: number,
        key: string,
        value: unknown
      ) => void;
    }
  ) => {
    updatedRow: TimesheetRow;
    isValid: boolean;
    error: ValidationError | null;
    shouldSkip: boolean;
  },
  normalizeRowDataFn: (
    row: TimesheetRow,
    projectNeedsTools: (p?: string) => boolean,
    toolNeedsChargeCode: (t?: string) => boolean
  ) => TimesheetRow,
  projectNeedsToolsWrapper: (p?: string) => boolean,
  toolNeedsChargeCodeWrapper: (t?: string) => boolean,
  hasTimeOverlapWithPreviousEntriesFn: (
    rowIndex: number,
    rows: TimesheetRow[]
  ) => boolean,
  isTimeOutAfterTimeInFn: (timeIn?: string, timeOut?: string) => boolean
): (changes: HandsontableChange[] | null, source: string) => void {
  return (changes: HandsontableChange[] | null, source: string) => {
    if (
      !changes ||
      source === "loadData" ||
      source === "updateData" ||
      source === "internal"
    )
      return;

    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    isProcessingChangeRef.current = true;

    const next = [...timesheetDraftData];
    const newErrors: ValidationError[] = [];
    const cellsToClearErrors: Array<{ row: number; col: number }> = [];
    let needsUpdate = false;
    for (const change of changes) {
      const [rowIdx] = change;
      if (!next[rowIdx]) continue;

      const currentRow = next[rowIdx];
      const result = processCellChangeFn(change, currentRow, hotInstance);

      if (result.shouldSkip) {
        if (result.error) {
          newErrors.push(result.error);
          window.logger?.verbose("Auto-cleared invalid data", {
            rowIdx,
            field: result.error.field,
            oldVal: result.updatedRow[result.error.field as keyof TimesheetRow],
          });
        }
        continue;
      }

      next[rowIdx] = result.updatedRow;
      needsUpdate = true;
      const [_, prop] = change;
      const propStr =
        typeof prop === "string"
          ? prop
          : typeof prop === "number"
            ? String(prop)
            : "";
      const colIdxRaw = hotInstance.propToCol(propStr);
      const colIdx = typeof colIdxRaw === "number" ? colIdxRaw : -1;
      if (colIdx >= 0) {
        cellsToClearErrors.push({ row: rowIdx, col: colIdx });
      }
    }

    const normalized = next.map((row) =>
      normalizeRowDataFn(
        row,
        projectNeedsToolsWrapper,
        toolNeedsChargeCodeWrapper
      )
    );
    const overlapErrors: ValidationError[] = [];
    const overlapClearedRows: number[] = [];
    for (let i = 0; i < normalized.length; i++) {
      const row = normalized[i];
      if (!row) continue;

      if (row.date && row.timeIn && row.timeOut) {
        const hasOverlap = hasTimeOverlapWithPreviousEntriesFn(i, normalized);
        const dateColIdx = hotInstance.propToCol("date");
        const timeInColIdx = hotInstance.propToCol("timeIn");
        const timeOutColIdx = hotInstance.propToCol("timeOut");

        if (hasOverlap) {
          // Mark overlap error on date column
          [dateColIdx, timeInColIdx, timeOutColIdx].forEach((colIdx) => {
            if (typeof colIdx === "number" && colIdx >= 0) {
              hotInstance.setCellMeta(i, colIdx, "className", "htInvalid");
            }
          });

          if (typeof dateColIdx === "number" && dateColIdx >= 0) {
            overlapErrors.push({
              row: i,
              col: dateColIdx,
              field: "date",
              message: `Time overlap detected on ${row.date || "this date"}`,
            });
          }
        } else {
          // No overlap - clear any existing overlap styling and track for error removal
          [dateColIdx, timeInColIdx, timeOutColIdx].forEach((colIdx) => {
            if (typeof colIdx === "number" && colIdx >= 0) {
              const rawClass = hotInstance.getCellMeta(i, colIdx).className;
              const currentClass = Array.isArray(rawClass)
                ? rawClass.join(" ")
                : rawClass || "";
              if (currentClass.includes("htInvalid")) {
                hotInstance.setCellMeta(
                  i,
                  colIdx,
                  "className",
                  currentClass.replace("htInvalid", "").trim()
                );
              }
            }
          });
          overlapClearedRows.push(i);
        }
      }
    }
    newErrors.push(...overlapErrors);

    // Check for timeOut > timeIn validation errors
    const timeOutErrors: ValidationError[] = [];
    const timeOutClearedRows: number[] = [];
    for (let i = 0; i < normalized.length; i++) {
      const row = normalized[i];
      if (!row) continue;
      const timeOutColIdx = hotInstance.propToCol("timeOut");

      if (row.timeIn && row.timeOut) {
        if (!isTimeOutAfterTimeInFn(row.timeIn, row.timeOut)) {
          // Mark error on timeOut column
          if (typeof timeOutColIdx === "number" && timeOutColIdx >= 0) {
            hotInstance.setCellMeta(i, timeOutColIdx, "className", "htInvalid");
            timeOutErrors.push({
              row: i,
              col: timeOutColIdx,
              field: "timeOut",
              message: `End time ${row.timeOut} must be after start time ${row.timeIn}`,
            });
          }
        } else {
          // Valid - clear any existing error styling on timeOut
          if (typeof timeOutColIdx === "number" && timeOutColIdx >= 0) {
            const rawClass = hotInstance.getCellMeta(
              i,
              timeOutColIdx
            ).className;
            const currentClass = Array.isArray(rawClass)
              ? rawClass.join(" ")
              : rawClass || "";
            if (currentClass.includes("htInvalid")) {
              hotInstance.setCellMeta(
                i,
                timeOutColIdx,
                "className",
                currentClass.replace("htInvalid", "").trim()
              );
            }
            timeOutClearedRows.push(i);
          }
        }
      }
    }
    newErrors.push(...timeOutErrors);

    // Add overlap-cleared rows to cellsToClearErrors so their errors get removed
    const dateColIdx = hotInstance.propToCol("date");
    if (typeof dateColIdx === "number" && dateColIdx >= 0) {
      for (const rowIdx of overlapClearedRows) {
        cellsToClearErrors.push({ row: rowIdx, col: dateColIdx });
      }
    }

    // Add timeOut-cleared rows to cellsToClearErrors
    const timeOutColIdxForClearing = hotInstance.propToCol("timeOut");
    if (
      typeof timeOutColIdxForClearing === "number" &&
      timeOutColIdxForClearing >= 0
    ) {
      for (const rowIdx of timeOutClearedRows) {
        cellsToClearErrors.push({ row: rowIdx, col: timeOutColIdxForClearing });
      }
    }

    if (needsUpdate) {
      setTimesheetDraftData(normalized);
      onChange?.(normalized);
    }
    setValidationErrors((prev) => {
      let filtered = prev;

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
    });
    for (const change of changes) {
      const [rowIdx] = change;
      if (normalized[rowIdx]) {
        unsavedRowsRef.current.set(rowIdx, normalized[rowIdx]);
      }
    }

    if (changes.length > 0) {
      setSaveButtonState("save");
    }

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
        const existingTimer = saveTimersRef.current.get(rowIdx);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        const timer = setTimeout(() => {
          void (async () => {
            window.logger?.verbose("[TimesheetGrid] Saving individual row", {
              rowIdx,
            });
            await saveAndReloadRow(row, rowIdx);
            saveTimersRef.current.delete(rowIdx);
          })();
        }, DEBOUNCE_DELAY);

        saveTimersRef.current.set(rowIdx, timer);
      }
    }

    hotInstance.render();

    setTimeout(() => {
      isProcessingChangeRef.current = false;
    }, 100);
  };
}

/**
 * Create handle after remove row callback
 */
export function createHandleAfterRemoveRow(
  hotTableRef: MutableRefObject<HotTableRef | null>,
  timesheetDraftData: TimesheetRow[],
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  onChange: ((rows: TimesheetRow[]) => void) | undefined,
  rowsPendingRemovalRef: MutableRefObject<TimesheetRow[]>
): (index: number, amount: number) => Promise<void> {
  return async (index: number, amount: number) => {
    const removedRows = rowsPendingRemovalRef.current || [];
    rowsPendingRemovalRef.current = [];

    /**
     * WHY: Handsontable sometimes calls afterRemoveRow without beforeRemoveRow hook,
     * causing missing row capture. This safety check prevents data loss by detecting
     * the edge case, though it means we skip DB deletion for those rows.
     */
    if (removedRows.length === 0) {
      const start = Math.max(0, index);
      window.logger?.warn(
        "No captured rows before deletion; skipping DB delete",
        { index: start, amount }
      );
      return;
    }

    // Delete from database
    const rowIds = removedRows
      .filter((row) => row?.id !== undefined && row?.id !== null)
      .map((row) => row.id!);

    if (rowIds.length > 0) {
      const deletedCount = await deleteDraftRows(rowIds);
      window.logger?.info("Rows removed from database successfully", {
        count: deletedCount,
        requested: amount,
      });
    }

    /**
     * WHY: Handsontable has already removed rows from its internal data at this point.
     * We need to sync React state to match, otherwise the state becomes stale and causes
     * inconsistencies in other operations.
     */
    if (!hotTableRef.current?.hotInstance) {
      window.logger?.warn(
        "Cannot sync state - Handsontable instance not available"
      );
      return;
    }

    const hotData =
      hotTableRef.current.hotInstance.getSourceData() as TimesheetRow[];
    window.logger?.verbose("Syncing state with Handsontable", {
      hotDataLength: hotData.length,
      oldStateLength: timesheetDraftData.length,
      deletedRowsCount: amount,
    });

    setTimesheetDraftData(hotData);
    onChange?.(hotData);
  };
}

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
        hotInstanceAfterPaste.render();
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
 * Create handle submit timesheet function
 */
export function createHandleSubmitTimesheet(
  isProcessingRef: MutableRefObject<boolean>,
  setIsProcessing: (value: boolean) => void,
  isAdmin: boolean,
  token: string | null,
  timesheetDraftData: TimesheetRow[],
  refreshTimesheetDraft: () => Promise<void>,
  refreshArchiveData: () => Promise<void>,
  submitTimesheetFn: (
    token: string,
    onSuccess?: () => Promise<void>
  ) => Promise<{
    error?: string;
    submitResult?: {
      ok: boolean;
      successCount: number;
      totalProcessed: number;
      removedCount: number;
      error?: string;
    };
  }>,
  logErrorFn: (message: string, meta?: Record<string, unknown>) => void,
  logWarnFn: (message: string, meta?: Record<string, unknown>) => void,
  logVerboseFn: (message: string, meta?: Record<string, unknown>) => void
): () => Promise<void> {
  return async () => {
    window.logger?.info("Submit button clicked");

    /**
     * WHY: Use synchronous ref instead of state to prevent race condition where
     * rapid clicks could start multiple submissions before state updates propagate.
     */
    if (isProcessingRef.current) {
      window.logger?.warn("Submit ignored - already processing (ref)");
      return;
    }

    if (isAdmin) {
      const errorMsg =
        "❌ Admin users cannot submit timesheet entries to SmartSheet.";
      window.alert(errorMsg);
      window.logger?.warn("Admin attempted timesheet submission");
      return;
    }

    if (!token) {
      const errorMsg = "❌ Session token is required. Please log in again.";
      window.alert(errorMsg);
      window.logger?.warn("Submit attempted without session token");
      return;
    }

    if (!timesheetDraftData || timesheetDraftData.length === 0) {
      const errorMsg = "❌ No timesheet data to submit.";
      window.alert(errorMsg);
      window.logger?.warn("Submit attempted with no data");
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);

    let submissionError: Error | null = null;
    let refreshError: Error | null = null;

    try {
      const res = await submitTimesheetFn(token, async () => {
        try {
          await refreshTimesheetDraft();
        } catch (err) {
          refreshError = err instanceof Error ? err : new Error(String(err));
          window.logger?.error(
            "Could not refresh timesheet data after submission",
            {
              error: refreshError.message,
            }
          );
        }
        try {
          await refreshArchiveData();
        } catch (err) {
          refreshError = err instanceof Error ? err : new Error(String(err));
          window.logger?.error(
            "Could not refresh archive data after submission",
            {
              error: refreshError.message,
            }
          );
        }
      });

      if (res.error) {
        submissionError = new Error(res.error);
        const errorMsg = `❌ Submission failed: ${res.error}`;
        window.alert(errorMsg);
        window.logger?.error("Timesheet submission failed", {
          error: res.error,
        });
        return;
      }

      if (res.submitResult && !res.submitResult.ok) {
        const errorDetails = res.submitResult.error || "Unknown error";
        submissionError = new Error(errorDetails);
        const errorMsg = `❌ Submission failed: ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries processed, ${res.submitResult.removedCount} failed. Error: ${errorDetails}`;
        window.alert(errorMsg);
        window.logger?.error("Timesheet submission partially failed", {
          successCount: res.submitResult.successCount,
          totalProcessed: res.submitResult.totalProcessed,
          removedCount: res.submitResult.removedCount,
          error: errorDetails,
        });
        return;
      }

      const submitMsg = res.submitResult
        ? `✅ Submitted ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries to SmartSheet`
        : "✅ No pending entries to submit";
      window.alert(submitMsg);
      window.logger?.info("Timesheet submission completed successfully", {
        successCount: res.submitResult?.successCount,
        totalProcessed: res.submitResult?.totalProcessed,
      });
    } catch (error) {
      submissionError =
        error instanceof Error ? error : new Error(String(error));
      const errorMsg = `❌ Unexpected error during submission: ${submissionError.message}`;
      window.logger?.error("Unexpected error during submission", {
        error: submissionError.message,
        stack: submissionError.stack,
      });
      window.alert(errorMsg);
    } finally {
      /**
       * WHY: Must reset state in finally block to prevent UI lockup if browser closed
       * during submission or if errors occur. Without this, submit button stays disabled.
       */
      window.logger?.verbose("Resetting submission state in finally block");
      isProcessingRef.current = false;
      setIsProcessing(false);

      /**
       * WHY: Refresh data even on error to handle partial successes where some entries
       * submitted but others failed. Ensures UI reflects actual database state.
       */
      if (!submissionError) {
        logVerboseFn("Refreshing data in finally block");
        try {
          await Promise.all([
            refreshTimesheetDraft().catch((err) => {
              logErrorFn("Could not refresh timesheet data in finally block", {
                error: err instanceof Error ? err.message : String(err),
              });
            }),
            refreshArchiveData().catch((err) => {
              logErrorFn("Could not refresh archive data in finally block", {
                error: err instanceof Error ? err.message : String(err),
              });
            }),
          ]);
        } catch (err) {
          logErrorFn("Error during data refresh in finally block", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (refreshError !== null && !submissionError) {
        const err: Error = refreshError as Error;
        const errorMessage = err.message || String(refreshError);
        logWarnFn("Submission succeeded but data refresh failed", {
          error: errorMessage,
        });
      }
    }
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
 * Create handle before key down callback
 */
export function createHandleBeforeKeyDown(
  hotTableRef: MutableRefObject<HotTableRef | null>,
  timesheetDraftData: TimesheetRow[],
  weekdayPatternRef: MutableRefObject<boolean>,
  getSmartPlaceholder: (
    previousRow: TimesheetRow | undefined,
    allRows: TimesheetRow[],
    weekdayPattern: boolean
  ) => string,
  incrementDate: (
    date: string,
    days: number,
    weekdayPattern: boolean
  ) => string,
  formatDateForDisplay: (date: Date) => string
): (event: globalThis.KeyboardEvent) => void {
  return (event: globalThis.KeyboardEvent) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    const selected = hotInstance.getSelected();
    if (!selected || selected.length === 0) return;

    const firstSelection = selected[0];
    if (!firstSelection) return;
    const [row, col] = firstSelection;
    if (typeof row !== "number" || typeof col !== "number") return;

    // Only handle date column (column 1, after hidden ID column)
    if (col !== 1) return;

    const rowData = timesheetDraftData[row];
    if (!rowData) return;

    let dateToInsert: string | null = null;
    let shouldPreventDefault = false;

    // Get the smart placeholder for this cell
    const previousRow = row > 0 ? timesheetDraftData[row - 1] : undefined;
    const smartPlaceholder = getSmartPlaceholder(
      previousRow,
      timesheetDraftData,
      weekdayPatternRef.current
    );

    // Check if the date editor is currently open
    const editor = hotInstance.getActiveEditor();
    const isEditorOpen = editor && editor.isOpened && editor.isOpened();

    // Handle different key combinations
    if (event.key === "Tab" && event.ctrlKey) {
      // Ctrl+Tab: insert day after the last entry (regardless of smart suggestion)
      const lastEntryWithDate = timesheetDraftData
        .slice(0, row)
        .reverse()
        .find((r) => r.date);

      if (lastEntryWithDate?.date) {
        dateToInsert = incrementDate(
          lastEntryWithDate.date,
          1,
          weekdayPatternRef.current
        );
        shouldPreventDefault = true;
      }
    } else if (event.key === "Tab" && event.shiftKey) {
      // Shift+Tab: insert day after placeholder
      if (!rowData.date && smartPlaceholder) {
        dateToInsert = incrementDate(
          smartPlaceholder,
          1,
          weekdayPatternRef.current
        );
        shouldPreventDefault = true;
      }
    } else if (event.key === "Tab") {
      // Tab: accept placeholder value (works even when date picker is open)
      if (!rowData.date && smartPlaceholder) {
        dateToInsert = smartPlaceholder;
        shouldPreventDefault = true;
      }
    } else if (event.ctrlKey && event.key === "t") {
      // Insert today's date
      dateToInsert = formatDateForDisplay(new Date());
      shouldPreventDefault = true;
    }

    if (dateToInsert && shouldPreventDefault) {
      event.preventDefault();
      event.stopPropagation();

      // If editor is open, close it first
      if (isEditorOpen && editor) {
        editor.finishEditing(false, false);
      }

      // Insert the date (column 1)
      hotInstance.setDataAtCell(row, 1, dateToInsert);

      // Move focus to next column (timeIn at column 2)
      setTimeout(() => {
        hotInstance.selectCell(row, 2);
      }, 10);
    }
  };
}

/**
 * Create handle after selection callback
 */
export function createHandleAfterSelection(
  hotTableRef: MutableRefObject<HotTableRef | null>,
  previousSelectionRef: MutableRefObject<{ row: number; col: number } | null>,
  setValidationErrors: (
    updater: (prev: ValidationError[]) => ValidationError[]
  ) => void
): (row: number, col: number) => void {
  return (row: number, col: number) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    // Validate row and col are valid unsigned integers (Handsontable can pass -1 for headers)
    if (
      row < 0 ||
      col < 0 ||
      !Number.isInteger(row) ||
      !Number.isInteger(col)
    ) {
      return;
    }

    const prevSelection = previousSelectionRef.current;

    // If user moved away from a cell
    if (
      prevSelection &&
      (prevSelection.row !== row || prevSelection.col !== col)
    ) {
      // Validate previous selection coordinates before using them
      if (
        prevSelection.row < 0 ||
        prevSelection.col < 0 ||
        !Number.isInteger(prevSelection.row) ||
        !Number.isInteger(prevSelection.col)
      ) {
        // Update current selection and skip invalid cell cleanup
        previousSelectionRef.current = { row, col };
        return;
      }

      // Check if previous cell was invalid
      const cellMeta = hotInstance.getCellMeta(
        prevSelection.row,
        prevSelection.col
      );
      if (cellMeta.className === "htInvalid") {
        // Clear the invalid cell value after a brief delay
        setTimeout(() => {
          hotInstance.setDataAtCell(
            prevSelection.row,
            prevSelection.col,
            "",
            "clearInvalid"
          );

          // Clear the validation error styling
          hotInstance.setCellMeta(
            prevSelection.row,
            prevSelection.col,
            "className",
            ""
          );
          hotInstance.render();

          // Remove the error from state
          setValidationErrors((prev) =>
            prev.filter(
              (err) =>
                !(
                  err.row === prevSelection.row && err.col === prevSelection.col
                )
            )
          );

          window.logger?.verbose("Cleared invalid entry", {
            row: prevSelection.row,
            col: prevSelection.col,
          });
        }, 100);
      }
    }

    // Update previous selection
    previousSelectionRef.current = { row, col };
  };
}

/**
 * Create handle refresh function
 */
export function createHandleRefresh(
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  logInfoFn: (message: string, meta?: Record<string, unknown>) => void,
  logWarnFn: (message: string, meta?: Record<string, unknown>) => void,
  logErrorFn: (message: string, meta?: Record<string, unknown>) => void,
  resetInProgressIpcFn: () => Promise<{
    success: boolean;
    count?: number;
    error?: string;
  }>,
  loadDraftIpcFn: () => Promise<{
    success: boolean;
    entries?: TimesheetRow[];
    error?: string;
  }>
): () => Promise<void> {
  return async () => {
    logInfoFn(
      "Refresh button clicked - resetting in-progress entries and reloading table"
    );
    try {
      // First, explicitly reset in-progress entries
      const resetResult = await resetInProgressIpcFn();
      if (resetResult.success) {
        logInfoFn("Reset in-progress entries", {
          count: resetResult.count || 0,
        });
        if (resetResult.count && resetResult.count > 0) {
          window.alert(
            `✅ Reset ${resetResult.count} in-progress ${resetResult.count === 1 ? "entry" : "entries"} to pending status.`
          );
        }
      } else if (resetResult.error) {
        logWarnFn("Could not reset in-progress entries", {
          error: resetResult.error,
        });
      }

      // Then refresh the table data
      const response = await loadDraftIpcFn();
      if (response?.success) {
        const draftData = response.entries || [];
        const rowsWithBlank =
          draftData.length > 0 && Object.keys(draftData[0] || {}).length > 0
            ? [...draftData, {}]
            : [{}];
        setTimesheetDraftData(rowsWithBlank);
        logInfoFn("Table refreshed successfully", { count: draftData.length });
      } else {
        logWarnFn("Refresh failed", { error: response?.error });
        window.alert(
          `⚠️ Could not load table data: ${response?.error || "Unknown error"}`
        );
      }
    } catch (error) {
      logErrorFn("Could not refresh table", {
        error: error instanceof Error ? error.message : String(error),
      });
      window.alert(
        `❌ Could not refresh table: ${error instanceof Error ? error.message : String(error)}`
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
