import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';
import { deleteDraft, saveDraft, loadDraft } from '@/services/ipc/timesheet';
import { logDebug, logError, logInfo, logVerbose, logWarn } from '@/services/ipc/logger';

const LOCAL_BACKUP_KEY = 'sheetpilot_timesheet_backup';

/**
 * Checks if a row has any non-empty field values
 */
function isRowNonEmpty(row: TimesheetRow): boolean {
  return !!(
    row.date ||
    row.hours !== undefined ||
    row.project ||
    row.taskDescription ||
    row.tool ||
    row.chargeCode
  );
}

const normalizeDraftRow = (row: TimesheetRow): TimesheetRow => ({
  ...row,
  tool: row.tool ?? null,
  chargeCode: row.chargeCode ?? null
});

const saveCompleteRow = async (row: TimesheetRow): Promise<boolean> => {
  try {
    const result = await saveDraft(normalizeDraftRow(row));
    if (result.success) {
      return true;
    }
    logWarn('Could not save row to database', {
      date: row.date,
      project: row.project,
      error: result.error
    });
    return false;
  } catch (error) {
    logError('Encountered error saving row to database', {
      date: row.date,
      project: row.project,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const runSequential = async <T, R>(
  items: T[],
  handler: (item: T) => Promise<R>
): Promise<R[]> =>
  items.reduce(
    async (accPromise, item) => {
      const acc = await accPromise;
      const result = await handler(item);
      return [...acc, result];
    },
    Promise.resolve([] as R[])
  );

const getSaveCounts = (results: boolean[]) =>
  results.reduce(
    (acc, isSaved) => ({
      savedCount: acc.savedCount + (isSaved ? 1 : 0),
      errorCount: acc.errorCount + (isSaved ? 0 : 1)
    }),
    { savedCount: 0, errorCount: 0 }
  );

const buildCurrentIdSet = (rows: TimesheetRow[]) =>
  new Set(
    rows
      .map((row) => row.id)
      .filter((id): id is number => id !== undefined && id !== null)
  );

const getOrphanedRows = (
  entries: TimesheetRow[],
  currentIds: Set<number>
): TimesheetRow[] =>
  entries.filter(
    (entry) =>
      entry.id !== undefined &&
      entry.id !== null &&
      !currentIds.has(entry.id)
  );

const deleteOrphanedRow = async (orphan: TimesheetRow): Promise<boolean> => {
  if (orphan.id === undefined || orphan.id === null) {
    return false;
  }
  try {
    const deleteResult = await deleteDraft(orphan.id);
    if (deleteResult.success) {
      return true;
    }
    logWarn('Could not delete orphaned row', {
      id: orphan.id,
      error: deleteResult.error
    });
    return false;
  } catch (error) {
    logError('Encountered error deleting orphaned row', {
      id: orphan.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const countDeletedRows = (results: boolean[]) =>
  results.reduce((count, deleted) => count + (deleted ? 1 : 0), 0);

/**
 * Save timesheet rows to localStorage as a backup
 * Filters out completely empty rows before saving
 */
export function saveLocalBackup(data: TimesheetRow[]): void {
  try {
    const nonEmptyRows = data.filter(isRowNonEmpty);
    const backup = {
      data: nonEmptyRows,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backup));
  } catch (error) {
    // Silently handle errors (e.g., QuotaExceededError)
    // Don't throw - local backup is a nice-to-have, not critical
    logWarn('Could not save local backup', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Save a single row to the database and return the saved entry
 */
export async function saveRowToDatabase(
  row: TimesheetRow
): Promise<{ success: boolean; entry?: TimesheetRow; error?: string }> {
  try {
    // Allow partial row saves - no validation check for required fields
    // Backend will handle validation and return appropriate errors
    logDebug('Saving row (partial data allowed)', { 
      hasDate: !!row.date,
      hasHours: row.hours !== undefined && row.hours !== null,
      hasProject: !!row.project,
      hasTaskDescription: !!row.taskDescription
    });
    const result = await saveDraft(row);
    if (result.success && result.entry) {
      logVerbose('Row saved to database successfully', { id: result.entry.id, date: result.entry.date });
      return { success: true, entry: result.entry };
    }

    logWarn('Could not save row to database', { error: result.error, date: row.date, project: row.project });
    return { success: false, error: result.error || 'Unknown error' };
  } catch (error) {
    logError('Encountered error saving row to database', { 
      date: row.date,
      project: row.project,
      error: error instanceof Error ? error.message : String(error) 
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}


/**
 * Batch save all complete rows to database and sync orphaned rows
 */
export async function batchSaveToDatabase(
  timesheetDraftData: TimesheetRow[]
): Promise<void> {
  try {
    logInfo('Starting batch save to database');
    
    // Save complete rows from Handsontable to database
    const completeRows = timesheetDraftData.filter(row => 
      row.date && row.hours !== undefined && row.hours !== null && row.project && row.taskDescription
    );
    
    logInfo('Batch saving rows to database', { count: completeRows.length });
    const saveResults = await runSequential(completeRows, saveCompleteRow);
    const { savedCount, errorCount } = getSaveCounts(saveResults);
    
    // Delete orphaned rows (rows in database that are not in current data)
    try {
      const loadResult = await loadDraft();
      if (loadResult.success && loadResult.entries) {
        const currentIds = buildCurrentIdSet(completeRows);
        const orphanedRows = getOrphanedRows(loadResult.entries, currentIds);
        
        if (orphanedRows.length > 0) {
          logInfo('Deleting orphaned rows from database', { count: orphanedRows.length });
          const deleteResults = await runSequential(
            orphanedRows,
            deleteOrphanedRow
          );
          const deletedCount = countDeletedRows(deleteResults);
          
          logInfo('Orphan deletion completed', { 
            total: orphanedRows.length,
            deleted: deletedCount
          });
        }
      }
    } catch (error) {
      logWarn('Could not check for orphaned rows', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
    
    logInfo('Batch save completed', { 
      total: completeRows.length,
      saved: savedCount,
      errors: errorCount
    });
  } catch (error) {
    logError('Batch save failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Delete draft rows from the database
 */
export async function deleteDraftRows(rowIds: number[]): Promise<number> {
  const deleteResults = await runSequential(rowIds, async (rowId) => {
    try {
      const res = await deleteDraft(rowId);
      if (res?.success) {
        return true;
      }
      logWarn('Could not delete draft row', {
        id: rowId,
        error: res?.error
      });
      return false;
    } catch (err) {
      logError('Encountered error deleting draft row', {
        id: rowId,
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
  });

  return countDeletedRows(deleteResults);
}

