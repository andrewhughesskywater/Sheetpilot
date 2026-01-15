/**
 * Paste-related operations for timesheet grid
 * 
 * Handles pasting data into the grid, including tool/charge code application,
 * normalization, and immediate saving of pasted rows.
 */

import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';
import type { MutableRefObject } from 'react';

/**
 * Apply pasted tool and charge code values to Handsontable
 */
export function applyPastedToolAndChargeCode(
  data: unknown[][],
  startRow: number,
  startCol: number,
  hotInstance: { propToCol: (prop: string) => number | unknown; setCellMeta: (row: number, col: number, key: string, value: unknown) => void; setDataAtCell: (row: number, col: number, value: unknown, source?: string) => void }
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
    if (startCol <= 3 && tool !== undefined && tool !== null && tool !== '') {
      if (typeof toolCol === 'number' && toolCol >= 0) {
        hotInstance.setCellMeta(targetRow, toolCol, 'allowInvalid', true);
        hotInstance.setCellMeta(targetRow, toolCol, 'strict', false);
        hotInstance.setDataAtCell(targetRow, toolCol, tool, 'paste');
        setTimeout(() => {
          hotInstance.setCellMeta(targetRow, toolCol, 'allowInvalid', false);
          hotInstance.setCellMeta(targetRow, toolCol, 'strict', true);
        }, 10);
      }
    }
    
    if (startCol <= 4 && chargeCode !== undefined && chargeCode !== null && chargeCode !== '') {
      if (typeof chargeCodeCol === 'number' && chargeCodeCol >= 0) {
        hotInstance.setCellMeta(targetRow, chargeCodeCol, 'allowInvalid', true);
        hotInstance.setCellMeta(targetRow, chargeCodeCol, 'strict', false);
        hotInstance.setDataAtCell(targetRow, chargeCodeCol, chargeCode, 'paste');
        setTimeout(() => {
          hotInstance.setCellMeta(targetRow, chargeCodeCol, 'allowInvalid', false);
          hotInstance.setCellMeta(targetRow, chargeCodeCol, 'strict', true);
        }, 10);
      }
    }
  });
}

/**
 * Normalize pasted rows and update Handsontable if needed
 */
export function normalizePastedRows(
  pastedRowIndices: number[],
  currentData: TimesheetRow[],
  hotInstance: { propToCol: (prop: string) => number | unknown; setDataAtCell: (row: number, col: number, value: unknown, source?: string) => void; render: () => void },
  normalizeRowDataFn: (row: TimesheetRow, projectNeedsTools: (p?: string) => boolean, toolNeedsChargeCode: (t?: string) => boolean) => TimesheetRow,
  projectNeedsToolsWrapper: (p?: string) => boolean,
  toolNeedsChargeCodeWrapper: (t?: string) => boolean
): { updatedData: TimesheetRow[]; hasChanges: boolean } {
  const updatedData = [...currentData];
  let hasChanges = false;
  
  pastedRowIndices.forEach(rowIdx => {
    const row = updatedData[rowIdx];
    if (!row) return;
    
    const normalizedRow = normalizeRowDataFn(row, projectNeedsToolsWrapper, toolNeedsChargeCodeWrapper);
    
    if (normalizedRow.tool !== row.tool || normalizedRow.chargeCode !== row.chargeCode) {
      hasChanges = true;
      updatedData[rowIdx] = normalizedRow;
      
      if (normalizedRow.tool !== row.tool) {
        const toolCol = hotInstance.propToCol('tool');
        if (typeof toolCol === 'number' && toolCol >= 0) {
          hotInstance.setDataAtCell(rowIdx, toolCol, normalizedRow.tool, 'paste');
        }
      }
      if (normalizedRow.chargeCode !== row.chargeCode) {
        const chargeCodeCol = hotInstance.propToCol('chargeCode');
        if (typeof chargeCodeCol === 'number' && chargeCodeCol >= 0) {
          hotInstance.setDataAtCell(rowIdx, chargeCodeCol, normalizedRow.chargeCode, 'paste');
        }
      }
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
