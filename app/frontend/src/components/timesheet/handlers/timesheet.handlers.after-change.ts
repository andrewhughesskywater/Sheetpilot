/**
 * Handler for after change callback
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { MutableRefObject } from "react";
import type { HotTableRef } from "@handsontable/react-wrapper";
import type {
  HandsontableChange,
  ValidationError,
} from "@/components/timesheet/cell-processing/timesheet.cell-processing";
import {
  scheduleRowSaves,
} from "./timesheet.handlers.after-change.helpers";
import {
  processCellChanges,
  updateValidationErrors,
} from "./timesheet.handlers.after-change.process-changes";
import {
  updateUnsavedRows,
  updateSaveButtonState,
} from "./timesheet.handlers.after-change.finalize";

export type ButtonStatus = "saved" | "saving" | "save";

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
  toolNeedsChargeCodeWrapper: (t?: string) => boolean
): (changes: HandsontableChange[] | null, source: string) => void {
  return (changes: HandsontableChange[] | null, source: string) => {
    // WHY: Filter out updateData source immediately to prevent infinite loops.
    // Handsontable's React wrapper calls updateData when props change, which triggers
    // afterChange with source "updateData". If we process these, it can create a loop
    // where updateData -> afterChange -> state update -> prop change -> updateData.
    if (
      !changes ||
      source === "loadData" ||
      source === "updateData" ||
      source === "internal"
    ) {
      // Log only occasionally to reduce log spam during loops
      if (!window.__afterChangeSkipCount) {
        window.__afterChangeSkipCount = 0;
      }
      window.__afterChangeSkipCount++;
      if (window.__afterChangeSkipCount % 100 === 0) {
        window.logger?.verbose("[TimesheetGrid] afterChange: skipping (many times)", {
          reason: !changes ? "no changes" : "source filter",
          source,
          skipCount: window.__afterChangeSkipCount,
        });
      }
      return;
    }

    window.logger?.verbose("[TimesheetGrid] afterChange: processing", {
      source,
      changeCount: changes.length,
      isProcessing: isProcessingChangeRef.current,
    });

    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      window.logger?.verbose("[TimesheetGrid] afterChange: no hot instance");
      return;
    }

    isProcessingChangeRef.current = true;

    const { next, newErrors, cellsToClearErrors, needsUpdate } =
      processCellChanges(changes, timesheetDraftData, hotInstance, processCellChangeFn);

    const normalized = next.map((row) =>
      normalizeRowDataFn(
        row,
        projectNeedsToolsWrapper,
        toolNeedsChargeCodeWrapper
      )
    );

    if (needsUpdate) {
      // Only update state if data has actually changed to prevent infinite update loops
      // Compare normalized data with current data using JSON stringify for deep comparison
      const currentDataStr = JSON.stringify(timesheetDraftData);
      const normalizedDataStr = JSON.stringify(normalized);
      
      if (currentDataStr !== normalizedDataStr) {
        window.logger?.verbose("[TimesheetGrid] afterChange: data changed, calling setTimesheetDraftData", {
          currentLength: timesheetDraftData.length,
          normalizedLength: normalized.length,
          source,
        });
        setTimesheetDraftData(normalized);
        onChange?.(normalized);
      } else {
        window.logger?.verbose("[TimesheetGrid] afterChange: data unchanged, skipping setTimesheetDraftData", {
          source,
        });
      }
    }
    setValidationErrors((prev) =>
      updateValidationErrors(cellsToClearErrors, newErrors, prev)
    );
    updateUnsavedRows(changes, normalized, unsavedRowsRef);
    updateSaveButtonState(changes, setSaveButtonState);

    scheduleRowSaves(changes, normalized, saveTimersRef.current, saveAndReloadRow);

    // WHY: Removed manual render() call - Handsontable's React wrapper will re-render
    // when data prop changes. Calling render() here can cause infinite update loops
    // because it triggers Handsontable's internal hooks which update React state.

    setTimeout(() => {
      isProcessingChangeRef.current = false;
    }, 100);
  };
}
