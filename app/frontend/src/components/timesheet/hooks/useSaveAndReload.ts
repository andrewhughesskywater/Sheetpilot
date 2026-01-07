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

  const rowsFieldsMatch = (a: TimesheetRow, b: TimesheetRow): boolean => {
    return (
      a.date === b.date &&
      a.timeIn === b.timeIn &&
      a.timeOut === b.timeOut &&
      a.project === b.project &&
      (a.tool ?? null) === (b.tool ?? null) &&
      (a.chargeCode ?? null) === (b.chargeCode ?? null) &&
      a.taskDescription === b.taskDescription
    );
  };

  const applySavedEntry = (
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
  };

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
        const savedEntry = saveResult.entry;
        if (rowsFieldsMatch(row, savedEntry)) {
          unsavedRowsRef.current.delete(rowIdx);
          window.logger?.verbose('Row synced successfully', { id: savedEntry.id, rowIdx });
        } else {
          window.logger?.debug('Row values changed during save (race condition)', { rowIdx, saved: savedEntry, current: row });
        }
        const hotInstance = (window as any).hotTableRef?.current?.hotInstance;
        if (hotInstance) {
          const currentData = hotInstance.getSourceData() as TimesheetRow[];
          const updated = applySavedEntry(currentData, rowIdx, savedEntry);
          if (updated) {
            window.logger?.verbose('Row saved and state updated', { id: savedEntry.id, rowIdx });
          }
        }
      } else {
        window.logger?.warn('Could not save row to database', { error: saveResult.error, rowIdx });
      }

      pendingSaveRef.current.delete(rowIdx);
      inFlightSavesRef.current.delete(rowIdx);
      updateSaveButtonState?.();
    } catch (error) {
      if (abortController.signal.aborted) return;
      window.logger?.error('Encountered error saving and reloading row', {
        rowIdx,
        error: error instanceof Error ? error.message : String(error)
      });
      pendingSaveRef.current.delete(rowIdx);
      inFlightSavesRef.current.delete(rowIdx);
      updateSaveButtonState?.();
    }
  }, [onChange, setTimesheetDraftData, updateSaveButtonState]);

  return {
    saveAndReloadRow,
    unsavedRowsRef,
    inFlightSavesRef,
    pendingSaveRef
  };
}
