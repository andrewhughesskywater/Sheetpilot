import { useCallback, useRef } from 'react';
import type { TimesheetRow } from '../timesheet.schema';
import { saveRowToDatabase } from '../timesheet.persistence';

export function useSaveAndReload(
  setTimesheetDraftData: (rows: TimesheetRow[]) => void,
  onChange?: (rows: TimesheetRow[]) => void,
  updateSaveButtonState?: () => void
) {
  const unsavedRowsRef = useRef<Map<number, TimesheetRow>>(new Map());
  const inFlightSavesRef = useRef<Map<number, AbortController>>(new Map());
  const pendingSaveRef = useRef<Map<number, TimesheetRow>>(new Map());

  const rowsFieldsMatch = useCallback((a: TimesheetRow, b: TimesheetRow): boolean => {
    return (
      a.date === b.date &&
      a.timeIn === b.timeIn &&
      a.timeOut === b.timeOut &&
      a.project === b.project &&
      (a.tool ?? null) === (b.tool ?? null) &&
      (a.chargeCode ?? null) === (b.chargeCode ?? null) &&
      a.taskDescription === b.taskDescription
    );
  }, []);

  const applySavedEntry = useCallback((
    currentData: TimesheetRow[],
    currentRowIdx: number,
    savedEntry: TimesheetRow
  ) => {
    const currentRow = currentData[currentRowIdx];
    if (!currentRow) return false;
    const needsUpdate = !currentRow.id || currentRow.id !== savedEntry.id || currentRow.timeIn !== savedEntry.timeIn || currentRow.timeOut !== savedEntry.timeOut;
    if (needsUpdate) {
      const updatedData = [...currentData];
      updatedData[currentRowIdx] = { ...currentRow, ...savedEntry };
      setTimesheetDraftData(updatedData);
      onChange?.(updatedData);
      return true;
    }
    return false;
  }, [onChange, setTimesheetDraftData]);

  const handleSaveSuccess = useCallback((
    savedEntry: TimesheetRow,
    originalRow: TimesheetRow,
    rowIdx: number
  ) => {
    if (rowsFieldsMatch(originalRow, savedEntry)) {
      unsavedRowsRef.current.delete(rowIdx);
      window.logger?.verbose('Row synced successfully', { id: savedEntry.id, rowIdx });
    } else {
      window.logger?.debug('Row values changed during save (race condition)', { rowIdx, saved: savedEntry, current: originalRow });
    }
    
    interface WindowWithHotTableRef extends Window {
      hotTableRef?: { current?: { hotInstance?: { getSourceData: () => unknown[] } } };
    }
    const hotInstance = (window as WindowWithHotTableRef).hotTableRef?.current?.hotInstance;
    if (hotInstance) {
      const currentData = hotInstance.getSourceData() as TimesheetRow[];
      const updated = applySavedEntry(currentData, rowIdx, savedEntry);
      if (updated) {
        window.logger?.verbose('Row saved and state updated', { id: savedEntry.id, rowIdx });
      }
    }
  }, [applySavedEntry, rowsFieldsMatch]);

  const cleanupSaveOperation = useCallback((rowIdx: number) => {
    pendingSaveRef.current.delete(rowIdx);
    inFlightSavesRef.current.delete(rowIdx);
    updateSaveButtonState?.();
  }, [updateSaveButtonState]);

  const saveAndReloadRow = useCallback(async (row: TimesheetRow, rowIdx: number) => {
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
        handleSaveSuccess(saveResult.entry, row, rowIdx);
      } else {
        window.logger?.warn('Could not save row to database', { error: saveResult.error, rowIdx });
      }

      cleanupSaveOperation(rowIdx);
    } catch (error) {
      if (abortController.signal.aborted) return;
      window.logger?.error('Encountered error saving and reloading row', {
        rowIdx,
        error: error instanceof Error ? error.message : String(error)
      });
      cleanupSaveOperation(rowIdx);
    }
  }, [handleSaveSuccess, cleanupSaveOperation]);

  return {
    saveAndReloadRow,
    unsavedRowsRef,
    inFlightSavesRef,
    pendingSaveRef
  };
}
