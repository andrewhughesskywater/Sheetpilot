/**
 * Paste-related operations for timesheet grid
 * 
 * Handles pasting data into the grid, including tool/charge code application,
 * normalization, and immediate saving of pasted rows.
 */

import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';
import type { MutableRefObject } from 'react';

type PasteHotInstance = {
  propToCol: (prop: string) => number | unknown;
  setCellMeta: (row: number, col: number, key: string, value: unknown) => void;
  setDataAtCell: (
    row: number,
    col: number,
    value: unknown,
    source?: string
  ) => void;
};

type NormalizeHotInstance = {
  propToCol: (prop: string) => number | unknown;
  setDataAtCell: (
    row: number,
    col: number,
    value: unknown,
    source?: string
  ) => void;
  render: () => void;
};

type NormalizeRowDataFn = (
  row: TimesheetRow,
  projectNeedsTools: (p?: string) => boolean,
  toolNeedsChargeCode: (t?: string) => boolean
) => TimesheetRow;

function isNonEmptyValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function isValidColumnIndex(
  columnIndex: number | unknown
): columnIndex is number {
  return typeof columnIndex === 'number' && columnIndex >= 0;
}

function shouldApplyPastedValue(
  startCol: number,
  minCol: number,
  value: unknown
): boolean {
  return startCol <= minCol && isNonEmptyValue(value);
}

function applyPastedValue(
  hotInstance: PasteHotInstance,
  targetRow: number,
  columnIndex: number | unknown,
  startCol: number,
  minCol: number,
  value: unknown
): void {
  if (!shouldApplyPastedValue(startCol, minCol, value)) {
    return;
  }
  if (!isValidColumnIndex(columnIndex)) {
    return;
  }

  hotInstance.setCellMeta(targetRow, columnIndex, 'allowInvalid', true);
  hotInstance.setCellMeta(targetRow, columnIndex, 'strict', false);
  hotInstance.setDataAtCell(targetRow, columnIndex, value, 'paste');
  setTimeout(() => {
    hotInstance.setCellMeta(targetRow, columnIndex, 'allowInvalid', false);
    hotInstance.setCellMeta(targetRow, columnIndex, 'strict', true);
  }, 10);
}

function normalizeRowAndUpdateHotTable(
  row: TimesheetRow,
  rowIdx: number,
  hotInstance: NormalizeHotInstance,
  normalizeRowDataFn: NormalizeRowDataFn,
  projectNeedsToolsWrapper: (p?: string) => boolean,
  toolNeedsChargeCodeWrapper: (t?: string) => boolean
): { normalizedRow: TimesheetRow; hasRowChanges: boolean } {
  const normalizedRow = normalizeRowDataFn(
    row,
    projectNeedsToolsWrapper,
    toolNeedsChargeCodeWrapper
  );
  const toolChanged = normalizedRow.tool !== row.tool;
  const chargeCodeChanged = normalizedRow.chargeCode !== row.chargeCode;

  if (toolChanged) {
    const toolCol = hotInstance.propToCol('tool');
    if (isValidColumnIndex(toolCol)) {
      hotInstance.setDataAtCell(rowIdx, toolCol, normalizedRow.tool, 'paste');
    }
  }
  if (chargeCodeChanged) {
    const chargeCodeCol = hotInstance.propToCol('chargeCode');
    if (isValidColumnIndex(chargeCodeCol)) {
      hotInstance.setDataAtCell(
        rowIdx,
        chargeCodeCol,
        normalizedRow.chargeCode,
        'paste'
      );
    }
  }

  return { normalizedRow, hasRowChanges: toolChanged || chargeCodeChanged };
}

/**
 * Apply pasted tool and charge code values to Handsontable
 */
export function applyPastedToolAndChargeCode(
  data: unknown[][],
  startRow: number,
  startCol: number,
  hotInstance: PasteHotInstance
): void {
  const toolCol = hotInstance.propToCol('tool');
  const chargeCodeCol = hotInstance.propToCol('chargeCode');
  
  data.forEach((row, i) => {
    const targetRow = startRow + i;
    if (targetRow < 0 || row.length < 6) return;
    
    const [_date, _hours, _project, tool, chargeCode, _taskDescription] = row;
    
    /**
     * WHY: Temporarily relax validation to allow pasting Tool values that aren't
     * in current project's dropdown. Without this, strict validation blocks the paste.
     * Validation gets re-enabled after 10ms to restore normal behavior.
     */
    applyPastedValue(hotInstance, targetRow, toolCol, startCol, 3, tool);
    applyPastedValue(
      hotInstance,
      targetRow,
      chargeCodeCol,
      startCol,
      4,
      chargeCode
    );
  });
}

/**
 * Normalize pasted rows and update Handsontable if needed
 */
export function normalizePastedRows(
  pastedRowIndices: number[],
  currentData: TimesheetRow[],
  hotInstance: NormalizeHotInstance,
  normalizeRowDataFn: NormalizeRowDataFn,
  projectNeedsToolsWrapper: (p?: string) => boolean,
  toolNeedsChargeCodeWrapper: (t?: string) => boolean
): { updatedData: TimesheetRow[]; hasChanges: boolean } {
  const pastedRowSet = new Set(pastedRowIndices);
  const updatedData = currentData.map((row, rowIdx) => {
    if (!pastedRowSet.has(rowIdx) || !row) {
      return row;
    }

    const { normalizedRow, hasRowChanges } = normalizeRowAndUpdateHotTable(
      row,
      rowIdx,
      hotInstance,
      normalizeRowDataFn,
      projectNeedsToolsWrapper,
      toolNeedsChargeCodeWrapper
    );

    return hasRowChanges ? normalizedRow : row;
  });

  const hasChanges = updatedData.some(
    (row, rowIdx) => row !== currentData[rowIdx]
  );

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
  pastedRowIndices.forEach(rowIdx => {
    const normalizedRow = normalizedData[rowIdx];
    if (!normalizedRow) return;
    
    // Check if row is complete (has all required fields)
    if (normalizedRow.date && normalizedRow.hours !== undefined && normalizedRow.hours !== null && 
        normalizedRow.project && normalizedRow.taskDescription) {
      // Clear any existing debounce timer for this row
      const existingTimer = saveTimersRef.current.get(rowIdx);
      if (existingTimer) {
        clearTimeout(existingTimer);
        saveTimersRef.current.delete(rowIdx);
      }
      
      // Remove from pending saves if present
      pendingSaveRef.current.delete(rowIdx);
      
      // Immediately save the row without debounce
      window.logger?.verbose('Immediately saving pasted row', { rowIdx });
      saveAndReloadRow(normalizedRow, rowIdx).catch(error => {
        window.logger?.error('Could not save pasted row immediately', {
          rowIdx,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }
  });
}
