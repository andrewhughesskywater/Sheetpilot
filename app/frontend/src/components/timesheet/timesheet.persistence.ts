import type { TimesheetRow } from './timesheet.schema';

const LOCAL_BACKUP_KEY = 'sheetpilot_timesheet_backup';

/**
 * Checks if a row has any non-empty field values
 */
function isRowNonEmpty(row: TimesheetRow): boolean {
  return !!(
    row.date ||
    row.timeIn ||
    row.timeOut ||
    row.project ||
    row.taskDescription ||
    row.tool ||
    row.chargeCode
  );
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
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backup));
  } catch (error) {
    // Silently handle errors (e.g., QuotaExceededError)
    // Don't throw - local backup is a nice-to-have, not critical
    window.logger?.warn('Could not save local backup', {
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
  if (!window.timesheet?.saveDraft) {
    window.logger?.warn('Save row skipped - timesheet API not available');
    return { success: false, error: 'Timesheet API not available' };
  }
  
  try {
    // Allow partial row saves - no validation check for required fields
    // Backend will handle validation and return appropriate errors
    window.logger?.debug('Saving row (partial data allowed)', { 
      hasDate: !!row.date,
      hasTimeIn: !!row.timeIn,
      hasTimeOut: !!row.timeOut,
      hasProject: !!row.project,
      hasTaskDescription: !!row.taskDescription
    });
    
    // Build draft data with only the fields that are present
    const draftData: {
      id?: number;
      date?: string;
      timeIn?: string;
      timeOut?: string;
      project?: string;
      tool?: string | null;
      chargeCode?: string | null;
      taskDescription?: string;
    } = {};
    
    if (row.id !== undefined) {
      draftData.id = row.id;
    }
    if (row.date) {
      draftData.date = row.date;
    }
    if (row.timeIn) {
      draftData.timeIn = row.timeIn;
    }
    if (row.timeOut) {
      draftData.timeOut = row.timeOut;
    }
    if (row.project) {
      draftData.project = row.project;
    }
    if (row.tool !== undefined) {
      draftData.tool = row.tool ?? null;
    }
    if (row.chargeCode !== undefined) {
      draftData.chargeCode = row.chargeCode ?? null;
    }
    if (row.taskDescription) {
      draftData.taskDescription = row.taskDescription;
    }
    
    const result = await window.timesheet.saveDraft(draftData);
    
    if (result.success && result.entry) {
      window.logger?.verbose('Row saved to database successfully', { 
        id: result.entry.id,
        date: result.entry.date 
      });
      return { success: true, entry: result.entry };
    } else {
      window.logger?.warn('Could not save row to database', { 
        error: result.error,
        date: row.date,
        project: row.project
      });
      return { success: false, error: result.error || 'Unknown error' };
    }
  } catch (error) {
    window.logger?.error('Encountered error saving row to database', { 
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
  if (!window.timesheet?.saveDraft || !window.timesheet?.loadDraft || !window.timesheet?.deleteDraft) {
    window.logger?.warn('Batch save skipped - timesheet API not available');
    return;
  }
  
  try {
    window.logger?.info('Starting batch save to database');
    
    // Save complete rows from Handsontable to database
    const completeRows = timesheetDraftData.filter(row => 
      row.date && row.timeIn && row.timeOut && row.project && row.taskDescription
    );
    
    if (completeRows.length === 0) {
      window.logger?.verbose('No complete rows to save to database');
      return;
    }
    
    window.logger?.info('Batch saving rows to database', { count: completeRows.length });
    
    let savedCount = 0;
    let errorCount = 0;
    
    for (const row of completeRows) {
      try {
        const draftData: {
          id?: number;
          date: string;
          timeIn: string;
          timeOut: string;
          project: string;
          tool?: string | null;
          chargeCode?: string | null;
          taskDescription: string;
        } = {
          date: row.date!,
          timeIn: row.timeIn!,
          timeOut: row.timeOut!,
          project: row.project!,
          tool: row.tool ?? null,
          chargeCode: row.chargeCode ?? null,
          taskDescription: row.taskDescription!
        };
        
        // CRITICAL: Include ID to update existing entry instead of creating new one
        if (row.id !== undefined) {
          draftData.id = row.id;
        }
        
        const result = await window.timesheet.saveDraft(draftData);
        
        if (result.success) {
          savedCount++;
        } else {
          errorCount++;
          window.logger?.warn('Could not save row to database', { 
            date: row.date,
            project: row.project,
            error: result.error 
          });
        }
      } catch (error) {
        errorCount++;
        window.logger?.error('Encountered error saving row to database', { 
          date: row.date,
          project: row.project,
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    window.logger?.info('Batch save completed', { 
      total: completeRows.length,
      saved: savedCount,
      errors: errorCount
    });
  } catch (error) {
    window.logger?.error('Batch save failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Delete draft rows from the database
 */
export async function deleteDraftRows(rowIds: number[]): Promise<number> {
  if (!window.timesheet?.deleteDraft) {
    window.logger?.error('Could not delete draft rows', { reason: 'timesheet API not available' });
    return 0;
  }

  let deletedCount = 0;
  for (const rowId of rowIds) {
    try {
      const res = await window.timesheet.deleteDraft(rowId);
      if (res?.success) {
        deletedCount++;
      } else {
        window.logger?.warn('Could not delete draft row', { id: rowId, error: res?.error });
      }
    } catch (err) {
      window.logger?.error('Encountered error deleting draft row', { id: rowId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return deletedCount;
}

