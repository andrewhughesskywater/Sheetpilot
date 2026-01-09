import { logDebug, logError, logInfo, logVerbose, logWarn } from '../../services/ipc/logger';
import { deleteDraft, saveDraft } from '../../services/ipc/timesheet';
import type { TimesheetRow } from './timesheet.schema';

const LOCAL_BACKUP_KEY = 'sheetpilot_timesheet_backup';

/**
 * Checks if a row has any non-empty field values
 */
function isRowNonEmpty(row: TimesheetRow): boolean {
  return Boolean(row.date || row.timeIn || row.timeOut || row.project || row.taskDescription || row.tool || row.chargeCode);
}

/**
 * Save timesheet rows to localStorage as a backup
 * Filters out completely empty rows before saving
 */
export function saveLocalBackup(data: TimesheetRow[]): void {
  try {
    const nonEmptyRows = data.filter(isRowNonEmpty);
    const backup = {
      data: nonEmptyRows,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backup));
  } catch (error) {
    // Silently handle errors (e.g., QuotaExceededError)
    // Don't throw - local backup is a nice-to-have, not critical
    logWarn('Could not save local backup', {
      error: error instanceof Error ? error.message : String(error),
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
      hasDate: Boolean(row.date),
      hasTimeIn: Boolean(row.timeIn),
      hasTimeOut: Boolean(row.timeOut),
      hasProject: Boolean(row.project),
      hasTaskDescription: Boolean(row.taskDescription),
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
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batch save all complete rows to database and sync orphaned rows
 */
export async function batchSaveToDatabase(timesheetDraftData: TimesheetRow[]): Promise<void> {
  try {
    logInfo('Starting batch save to database');

    // Save complete rows from Handsontable to database
    const completeRows = timesheetDraftData.filter(
      (row) => row.date && row.timeIn && row.timeOut && row.project && row.taskDescription
    );

    if (completeRows.length === 0) {
      logVerbose('No complete rows to save to database');
      return;
    }

    logInfo('Batch saving rows to database', { count: completeRows.length });

    let savedCount = 0;
    let errorCount = 0;

    for (const row of completeRows) {
      try {
        // Ensure optional fields get sent explicitly as null when not present.
        // This keeps the backend contract stable and matches tests/serialization expectations.
        const normalizedRow: TimesheetRow = {
          ...row,
          tool: row.tool ?? null,
          chargeCode: row.chargeCode ?? null,
        };

        const result = await saveDraft(normalizedRow);
        if (result.success) {
          savedCount++;
        } else {
          errorCount++;
          logWarn('Could not save row to database', {
            date: row.date,
            project: row.project,
            error: result.error,
          });
        }
      } catch (error) {
        errorCount++;
        logError('Encountered error saving row to database', {
          date: row.date,
          project: row.project,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logInfo('Batch save completed', {
      total: completeRows.length,
      saved: savedCount,
      errors: errorCount,
    });
  } catch (error) {
    logError('Batch save failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Delete draft rows from the database
 */
export async function deleteDraftRows(rowIds: number[]): Promise<number> {
  let deletedCount = 0;
  for (const rowId of rowIds) {
    try {
      const res = await deleteDraft(rowId);
      if (res?.success) {
        deletedCount++;
      } else {
        logWarn('Could not delete draft row', { id: rowId, error: res?.error });
      }
    } catch (err) {
      logError('Encountered error deleting draft row', {
        id: rowId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return deletedCount;
}
