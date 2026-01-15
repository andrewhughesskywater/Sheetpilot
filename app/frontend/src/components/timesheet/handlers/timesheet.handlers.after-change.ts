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
      setTimesheetDraftData(normalized);
      onChange?.(normalized);
    }
    setValidationErrors((prev) =>
      updateValidationErrors(cellsToClearErrors, newErrors, prev)
    );
    updateUnsavedRows(changes, normalized, unsavedRowsRef);
    updateSaveButtonState(changes, setSaveButtonState);

    scheduleRowSaves(changes, normalized, saveTimersRef.current, saveAndReloadRow);

    hotInstance.render();

    setTimeout(() => {
      isProcessingChangeRef.current = false;
    }, 100);
  };
}
