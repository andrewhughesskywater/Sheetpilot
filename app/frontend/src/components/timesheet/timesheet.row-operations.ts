/**
 * Row-level operations for timesheet grid
 * 
 * Handles operations on individual rows including saving, updating button state,
 * applying macros, duplicating rows, and cell configuration.
 */

import type { TimesheetRow } from './timesheet.schema';
import type { MutableRefObject } from 'react';
import type { HotTableRef } from '@handsontable/react-wrapper';
import type { MacroRow } from '../../utils/macroStorage';
import { saveRowToDatabase } from './timesheet.persistence';

type ButtonStatus = 'saved' | 'saving' | 'save';

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
      if (saveStartTimeRef.current === null) {
        saveStartTimeRef.current = Date.now();
        setSaveButtonState('saving');
      }
      
      const elapsed = Date.now() - (saveStartTimeRef.current || Date.now());
      const minDuration = 1000;
      
      if (elapsed >= minDuration) {
        const stillHasInFlight = inFlightSavesRef.current.size > 0;
        const stillHasUnsaved = unsavedRowsRef.current.size > 0;
        
        if (!stillHasInFlight && !stillHasUnsaved) {
          setSaveButtonState('saved');
          saveStartTimeRef.current = null;
        } else if (!stillHasInFlight && stillHasUnsaved) {
          setSaveButtonState('save');
          saveStartTimeRef.current = null;
        }
      } else {
        const remaining = minDuration - elapsed;
        setTimeout(() => {
          updateSaveButtonState();
        }, remaining);
      }
    } else {
      if (hasUnsavedRows) {
        setSaveButtonState('save');
      } else {
        setSaveButtonState('saved');
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
    const existingController = inFlightSavesRef.current.get(rowIdx);
    if (existingController) {
      existingController.abort();
      window.logger?.debug('Cancelled previous save operation for row', { rowIdx });
    }
    
    const abortController = new AbortController();
    inFlightSavesRef.current.set(rowIdx, abortController);
    
    try {
      const saveResult = await saveRowToDatabase(row);
      
      if (abortController.signal.aborted) {
        window.logger?.debug('Save operation aborted', { rowIdx });
        return;
      }
      
      if (saveResult.success && saveResult.entry) {
        const savedEntry = saveResult.entry;
        
        const hotInstance = hotTableRef.current?.hotInstance;
        if (hotInstance) {
          const currentData = hotInstance.getSourceData() as TimesheetRow[];
          const currentRow = currentData[rowIdx];
          
          if (!currentRow) {
            window.logger?.warn('Current row not found for receipt check', { rowIdx });
            unsavedRowsRef.current.delete(rowIdx);
            return;
          }
          
          const fieldsMatch = 
            currentRow.date === savedEntry.date &&
            currentRow.timeIn === savedEntry.timeIn &&
            currentRow.timeOut === savedEntry.timeOut &&
            currentRow.project === savedEntry.project &&
            (currentRow.tool ?? null) === (savedEntry.tool ?? null) &&
            (currentRow.chargeCode ?? null) === (savedEntry.chargeCode ?? null) &&
            currentRow.taskDescription === savedEntry.taskDescription;
          
          if (fieldsMatch) {
            unsavedRowsRef.current.delete(rowIdx);
            window.logger?.verbose('Row synced successfully', { 
              id: savedEntry.id,
              rowIdx 
            });
          } else {
            window.logger?.debug('Row values changed during save (race condition)', { 
              rowIdx,
              saved: savedEntry,
              current: currentRow
            });
          }
          
          const needsUpdate = !currentRow.id || currentRow.id !== savedEntry.id ||
                             currentRow.timeIn !== savedEntry.timeIn ||
                             currentRow.timeOut !== savedEntry.timeOut;

          if (needsUpdate) {
             const updatedData = [...currentData];
             updatedData[rowIdx] = { ...currentRow, ...savedEntry };
             
             setTimesheetDraftData(updatedData);
             onChange?.(updatedData);
             
             window.logger?.verbose('Row saved and state updated', { 
               id: savedEntry.id,
               rowIdx 
             });
          }
        }
      } else {
        window.logger?.warn('Could not save row to database', { 
          error: saveResult.error,
          rowIdx 
        });
      }
      
      pendingSaveRef.current.delete(rowIdx);
      inFlightSavesRef.current.delete(rowIdx);
      
      updateSaveButtonState();
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }
      
      window.logger?.error('Encountered error saving and reloading row', { 
        rowIdx,
        error: error instanceof Error ? error.message : String(error) 
      });
      pendingSaveRef.current.delete(rowIdx);
      inFlightSavesRef.current.delete(rowIdx);
      
      updateSaveButtonState();
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
  normalizeRowDataFn: (row: TimesheetRow, projectNeedsTools: (p?: string) => boolean, toolNeedsChargeCode: (t?: string) => boolean) => TimesheetRow,
  projectNeedsToolsWrapper: (p?: string) => boolean,
  toolNeedsChargeCodeWrapper: (t?: string) => boolean
): (macroIndex: number) => void {
  return (macroIndex: number) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      window.logger?.warn('Cannot apply macro - Handsontable instance not available');
      return;
    }

    const macro = macros[macroIndex];
    if (!macro || isMacroEmptyFn(macro)) {
      window.logger?.verbose('Macro is empty, skipping application', { macroIndex });
      return;
    }

    // Get current selection or find first empty row
    let targetRow = 0;
    const selected = hotInstance.getSelected();
    if (selected && selected.length > 0) {
      const firstSelection = selected[0];
      if (firstSelection && typeof firstSelection[0] === 'number') {
        targetRow = firstSelection[0]; // First selected row
      }
    } else {
      // Find first empty row
      const sourceData = hotInstance.getSourceData() as TimesheetRow[];
      const emptyRowIndex = sourceData.findIndex(row => 
        !row.date && !row.timeIn && !row.timeOut && !row.project && !row.taskDescription
      );
      if (emptyRowIndex >= 0) {
        targetRow = emptyRowIndex;
      } else {
        targetRow = sourceData.length; // Add to end if no empty row found
      }
    }

    window.logger?.info('Applying macro to row', { macroIndex: macroIndex + 1, targetRow });

    /**
     * WHY: Using setDataAtCell() would trigger validation that might block macro application.
     * Directly modifying source data bypasses these restrictions, then loadData() applies
     * changes with proper validation through the normal afterChange flow.
     */
    const sourceData = hotInstance.getSourceData() as TimesheetRow[];
    
    if (!sourceData[targetRow]) {
      sourceData[targetRow] = {
        date: '',
        timeIn: '',
        timeOut: '',
        project: '',
        tool: null,
        chargeCode: null,
        taskDescription: ''
      };
    }

    const updatedRow: TimesheetRow = { ...sourceData[targetRow] };
    if (macro.timeIn) updatedRow.timeIn = macro.timeIn;
    if (macro.timeOut) updatedRow.timeOut = macro.timeOut;
    if (macro.project) updatedRow.project = macro.project;
    if (macro.tool !== undefined) updatedRow.tool = macro.tool;
    if (macro.chargeCode !== undefined) updatedRow.chargeCode = macro.chargeCode;
    if (macro.taskDescription) updatedRow.taskDescription = macro.taskDescription;

    const normalizedRow = normalizeRowDataFn(updatedRow, projectNeedsToolsWrapper, toolNeedsChargeCodeWrapper);
    
    sourceData[targetRow] = normalizedRow;
    
    hotInstance.loadData(sourceData);
    
    setTimesheetDraftData(sourceData);
    onChange?.(sourceData);

    requestAnimationFrame(() => {
      hotInstance.selectCell(targetRow, 1);
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
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      window.logger?.warn('Cannot duplicate row - Handsontable instance not available');
      return;
    }

    const selected = hotInstance.getSelected();
    if (!selected || selected.length === 0) {
      window.logger?.verbose('No row selected for duplication');
      return;
    }

    const firstSelection = selected[0];
    const selectedRow = firstSelection?.[0];
    if (typeof selectedRow !== 'number') return;
    const rowData = hotInstance.getDataAtRow(selectedRow);
    
    if (!rowData || rowData.every(cell => !cell)) {
      window.logger?.verbose('Selected row is empty, skipping duplication');
      return;
    }

    window.logger?.info('Duplicating row', { selectedRow });

    hotInstance.alter('insert_row_below', selectedRow, 1);
    
    const newRow = selectedRow + 1;
    hotInstance.populateFromArray(newRow, 0, [rowData], undefined, undefined, 'overwrite');
    
    hotInstance.selectCell(newRow, 1);
  };
}

/**
 * Create cells function for Handsontable
 */
export function createCellsFunction(
  timesheetDraftData: TimesheetRow[],
  weekdayPatternRef: MutableRefObject<boolean>,
  getSmartPlaceholder: (previousRow: TimesheetRow | undefined, allRows: TimesheetRow[], weekdayPattern: boolean) => string,
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
    
    // Date column (col 1, after hidden ID at col 0) - smart placeholder
    if (col === 1 && !rowData.date) {
      const previousRow = row > 0 ? timesheetDraftData[row - 1] : undefined;
      const smartPlaceholder = getSmartPlaceholder(previousRow, timesheetDraftData, weekdayPatternRef.current);
      return {
        placeholder: smartPlaceholder
      };
    }
    
    // Tool column (col 5, after ID/Date/TimeIn/TimeOut/Project) - dynamic dropdown based on selected project
    if (col === 5) {
      const project = rowData?.project;
      if (!project || !doesProjectNeedToolsFn(project)) {
        return { 
          className: 'htDimmed', 
          placeholder: project ? 'N/A' : '',
          readOnly: false,
          source: []
        };
      }
      return { 
        source: [...getToolsForProjectFn(project)], 
        placeholder: 'Pick a Tool',
        readOnly: false
      };
    }
    
    // Charge code column (col 6) - conditional based on selected tool
    if (col === 6) {
      const tool = rowData?.tool;
      if (!tool || !doesToolNeedChargeCodeFn(tool)) {
        return { 
          className: 'htDimmed', 
          placeholder: tool ? 'N/A' : '',
          readOnly: false
        };
      }
      return { 
        placeholder: 'Pick a Charge Code',
        readOnly: false
      };
    }
    
    return {};
  };
}
