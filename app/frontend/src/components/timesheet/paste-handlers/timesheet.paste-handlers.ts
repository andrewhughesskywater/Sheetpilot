/**
 * Paste-related operations for timesheet grid
 *
 * Handles pasting data into the grid, including tool/charge code application,
 * normalization, and immediate saving of pasted rows.
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { MutableRefObject } from "react";
import {
  applyToolValue,
  applyChargeCodeValue,
  updateToolInHot,
  updateChargeCodeInHot,
} from "./paste-utils";

/**
 * Apply pasted tool and charge code values to Handsontable
 */
export function applyPastedToolAndChargeCode(
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
): void {
  const toolCol = hotInstance.propToCol("tool");
  const chargeCodeCol = hotInstance.propToCol("chargeCode");

  data.forEach((row, i) => {
    const targetRow = startRow + i;
    if (targetRow < 0 || row.length < 6) return;

    const [_date, _hours, _project, tool, chargeCode, _taskDescription] = row;

    /**
     * WHY: Temporarily relax validation to allow pasting Tool values that aren't
     * in current project's dropdown. Without this, strict validation blocks the paste.
     * Validation gets re-enabled after 10ms to restore normal behavior.
     */
    applyToolValue(hotInstance, targetRow, toolCol, tool, startCol);

    applyChargeCodeValue(
      hotInstance,
      targetRow,
      chargeCodeCol,
      chargeCode,
      startCol
    );
  });
}

/**
 * Process a single normalized row and update Handsontable if changes detected
 */
function processNormalizedRow(
  rowIdx: number,
  row: TimesheetRow,
  updatedData: TimesheetRow[],
  normalizedRow: TimesheetRow,
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
    setDataAtCell: (
      row: number,
      col: number,
      value: unknown,
      source?: string
    ) => void;
  }
): boolean {
  if (
    normalizedRow.tool !== row.tool ||
    normalizedRow.chargeCode !== row.chargeCode
  ) {
    updatedData[rowIdx] = normalizedRow;

    if (normalizedRow.tool !== row.tool) {
      updateToolInHot(hotInstance, rowIdx, normalizedRow.tool ?? null);
    }
    if (normalizedRow.chargeCode !== row.chargeCode) {
      updateChargeCodeInHot(hotInstance, rowIdx, normalizedRow.chargeCode ?? null);
    }
    return true;
  }
  return false;
}

/**
 * Normalize pasted rows and update Handsontable if needed
 */
export function normalizePastedRows(
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
): { updatedData: TimesheetRow[]; hasChanges: boolean } {
  const updatedData = [...currentData];
  let hasChanges = false;

  pastedRowIndices.forEach((rowIdx) => {
    const row = updatedData[rowIdx];
    if (!row) return;

    const normalizedRow = normalizeRowDataFn(
      row,
      projectNeedsToolsWrapper,
      toolNeedsChargeCodeWrapper
    );

    if (
      processNormalizedRow(rowIdx, row, updatedData, normalizedRow, hotInstance)
    ) {
      hasChanges = true;
    }
  });

  return { updatedData, hasChanges };
}

/**
 * Save complete pasted rows immediately (without debounce)
 */
export function savePastedRows(
  pastedRowIndices: number[],
  normalizedData: TimesheetRow[],
  saveTimersRef: MutableRefObject<Map<number, ReturnType<typeof setTimeout>>>,
  pendingSaveRef: MutableRefObject<Map<number, TimesheetRow>>,
  saveAndReloadRow: (row: TimesheetRow, rowIdx: number) => Promise<void>
): void {
  pastedRowIndices.forEach((rowIdx) => {
    const normalizedRow = normalizedData[rowIdx];
    if (!normalizedRow) return;

    // Check if row is complete (has all required fields)
    if (
      normalizedRow.date &&
      normalizedRow.hours !== undefined &&
      normalizedRow.hours !== null &&
      normalizedRow.project &&
      normalizedRow.taskDescription
    ) {
      // Clear any existing debounce timer for this row
      const existingTimer = saveTimersRef.current.get(rowIdx);
      if (existingTimer) {
        clearTimeout(existingTimer);
        saveTimersRef.current.delete(rowIdx);
      }

      // Remove from pending saves if present
      pendingSaveRef.current.delete(rowIdx);

      // Immediately save the row without debounce
      window.logger?.verbose("Immediately saving pasted row", { rowIdx });
      saveAndReloadRow(normalizedRow, rowIdx).catch((error) => {
        window.logger?.error("Could not save pasted row immediately", {
          rowIdx,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  });
}
