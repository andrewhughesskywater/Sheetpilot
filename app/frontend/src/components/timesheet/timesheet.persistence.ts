import type { TimesheetRow } from './timesheet.schema';

/**
 * Save a local backup of timesheet data to localStorage
 */
export function saveLocalBackup(data: TimesheetRow[]): void {
  try {
    const dataToBackup = data.filter(row => 
      row.date || row.timeIn || row.timeOut || row.project || row.taskDescription
    );
    localStorage.setItem('sheetpilot_timesheet_backup', JSON.stringify({
      data: dataToBackup,
      timestamp: new Date().toISOString()
    }));
    window.logger?.debug('Local backup saved', { rows: dataToBackup.length });
  } catch (error) {
    console.error('[timesheet.persistence] Could not save local backup:', error);
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
        const result = await window.timesheet.saveDraft({
          id: row.id,  // CRITICAL: Include ID to update existing entry instead of creating new one
          date: row.date!,
          timeIn: row.timeIn!,
          timeOut: row.timeOut!,
          project: row.project!,
          tool: row.tool ?? null,
          chargeCode: row.chargeCode ?? null,
          taskDescription: row.taskDescription!
        });
        
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

