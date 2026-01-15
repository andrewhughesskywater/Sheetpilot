/**
 * Row-level operations for timesheet grid
 *
 * Handles operations on individual rows including saving, updating button state,
 * applying macros, duplicating rows, and cell configuration.
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { MutableRefObject } from "react";
import type { HotTableRef } from "@handsontable/react-wrapper";
import type { MacroRow } from "@/utils/macroStorage";
import { saveRowToDatabase } from "@/components/timesheet/persistence/timesheet.persistence";
import { handleInFlightSaveButtonState } from "./timesheet.row-operations.helpers";
import {
  setupSaveAbortController,
  processSaveResult,
  cleanupSaveOperation,
  handleSaveError,
} from "./timesheet.row-operations.save-helpers";
import {
  validateMacroApplication,
  getMacroTargetRow,
  ensureRowExists,
  applyMacroAndNormalize,
} from "./timesheet.row-operations.macro-application-helpers";
import {
  validateDuplication,
  getSelectedRowForDuplication,
  performRowDuplication,
} from "./timesheet.row-operations.duplicate-helpers";
import { getCellConfigForColumn } from "./timesheet.row-operations.cells-helpers";

type ButtonStatus = "saved" | "saving" | "save";

/**
 * Create update save button state callback
 */
export function createUpdateSaveButtonState(
  unsavedRowsRef: MutableRefObject<Map<number, TimesheetRow>>,
  inFlightSavesRef: MutableRefObject<Map<number, AbortController>>,
  saveStartTimeRef: MutableRefObject<number | null>,
  setSaveButtonState: (state: ButtonStatus) => void
): () => void {
  const updateSaveButtonState = () => {
    const hasUnsavedRows = unsavedRowsRef.current.size > 0;
    const hasInFlightSaves = inFlightSavesRef.current.size > 0;
    if (hasInFlightSaves) {
      handleInFlightSaveButtonState(
        inFlightSavesRef,
        unsavedRowsRef,
        saveStartTimeRef,
        setSaveButtonState,
        updateSaveButtonState
      );
    } else {
      if (hasUnsavedRows) {
        setSaveButtonState("save");
      } else {
        setSaveButtonState("saved");
      }
      saveStartTimeRef.current = null;
    }
  };
  return updateSaveButtonState;
}

/**
 * Create save and reload row function
 */
export function createSaveAndReloadRow(
  hotTableRef: MutableRefObject<HotTableRef | null>,
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  onChange: ((rows: TimesheetRow[]) => void) | undefined,
  updateSaveButtonState: () => void,
  inFlightSavesRef: MutableRefObject<Map<number, AbortController>>,
  unsavedRowsRef: MutableRefObject<Map<number, TimesheetRow>>,
  pendingSaveRef: MutableRefObject<Map<number, TimesheetRow>>
): (row: TimesheetRow, rowIdx: number) => Promise<void> {
  return async (row: TimesheetRow, rowIdx: number) => {
    const abortController = setupSaveAbortController(inFlightSavesRef, rowIdx);

    try {
      const saveResult = await saveRowToDatabase(row);

      await processSaveResult(
        saveResult,
        abortController,
        rowIdx,
        hotTableRef,
        unsavedRowsRef,
        setTimesheetDraftData,
        onChange
      );

      cleanupSaveOperation(
        rowIdx,
        pendingSaveRef,
        inFlightSavesRef,
        updateSaveButtonState
      );
    } catch (error) {
      handleSaveError(
        error,
        rowIdx,
        abortController,
        pendingSaveRef,
        inFlightSavesRef,
        updateSaveButtonState
      );
    }
  };
}

/**
 * Create apply macro function
 */
export function createApplyMacro(
  hotTableRef: MutableRefObject<HotTableRef | null>,
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  onChange: ((rows: TimesheetRow[]) => void) | undefined,
  macros: MacroRow[],
  isMacroEmptyFn: (macro: MacroRow) => boolean,
  normalizeRowDataFn: (
    row: TimesheetRow,
    projectNeedsTools: (p?: string) => boolean,
    toolNeedsChargeCode: (t?: string) => boolean
  ) => TimesheetRow,
  projectNeedsToolsWrapper: (p?: string) => boolean,
  toolNeedsChargeCodeWrapper: (t?: string) => boolean
): (macroIndex: number) => void {
  return (macroIndex: number) => {
    const hotInstance = hotTableRef.current?.hotInstance ?? null;
    const macro = macros[macroIndex];

    const validation = validateMacroApplication(
      hotInstance,
      macro,
      isMacroEmptyFn,
      macroIndex
    );
    if (!validation.valid) {
      return;
    }

    const targetRowValidation = getMacroTargetRow(validation.hotInstance);
    if (!targetRowValidation.valid) {
      return;
    }

    const targetRow = targetRowValidation.targetRow;
    const sourceData = validation.hotInstance.getSourceData() as TimesheetRow[];

    window.logger?.info("Applying macro to row", {
      macroIndex: macroIndex + 1,
      targetRow,
    });

    /**
     * WHY: Using setDataAtCell() would trigger validation that might block macro application.
     * Directly modifying source data bypasses these restrictions, then loadData() applies
     * changes with proper validation through the normal afterChange flow.
     */
    ensureRowExists(sourceData, targetRow);

    applyMacroAndNormalize(
      sourceData,
      targetRow,
      validation.macro,
      normalizeRowDataFn,
      projectNeedsToolsWrapper,
      toolNeedsChargeCodeWrapper
    );

    validation.hotInstance.loadData(sourceData);

    setTimesheetDraftData(sourceData);
    onChange?.(sourceData);

    requestAnimationFrame(() => {
      validation.hotInstance.selectCell(targetRow, 1);
    });
  };
}

/**
 * Create duplicate selected row function
 */
export function createDuplicateSelectedRow(
  hotTableRef: MutableRefObject<HotTableRef | null>
): () => void {
  return () => {
    const validation = validateDuplication(hotTableRef.current?.hotInstance ?? null);
    if (!validation.valid) {
      return;
    }

    const rowValidation = getSelectedRowForDuplication(validation.hotInstance);
    if (!rowValidation.valid) {
      return;
    }

    performRowDuplication(
      validation.hotInstance,
      rowValidation.selectedRow,
      rowValidation.rowData
    );
  };
}

/**
 * Create cells function for Handsontable
 */
export function createCellsFunction(
  timesheetDraftData: TimesheetRow[],
  weekdayPatternRef: MutableRefObject<boolean>,
  getSmartPlaceholder: (
    previousRow: TimesheetRow | undefined,
    allRows: TimesheetRow[],
    weekdayPattern: boolean
  ) => string,
  doesProjectNeedToolsFn: (project?: string) => boolean,
  getToolsForProjectFn: (project: string) => string[],
  doesToolNeedChargeCodeFn: (tool?: string) => boolean
): (row: number, col: number) => Record<string, unknown> {
  return (row: number, col: number) => {
    // Add bounds checking to prevent out-of-bounds access
    if (row < 0 || row >= timesheetDraftData.length) {
      return {};
    }
    const rowData = timesheetDraftData[row];
    if (!rowData) {
      return {};
    }

    return getCellConfigForColumn(
      col,
      rowData,
      row,
      timesheetDraftData,
      weekdayPatternRef,
      getSmartPlaceholder,
      doesProjectNeedToolsFn,
      getToolsForProjectFn,
      doesToolNeedChargeCodeFn
    );
  };
}
