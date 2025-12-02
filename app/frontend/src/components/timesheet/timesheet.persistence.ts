import type { TimesheetRow } from './timesheet.schema';

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
    // Validate row has required fields before saving
    if (!row.date || !row.timeIn || !row.timeOut || !row.project || !row.taskDescription) {
      window.logger?.debug('Skipping save - row incomplete', { 
        hasDate: !!row.date,
        hasTimeIn: !!row.timeIn,
        hasTimeOut: !!row.timeOut,
        hasProject: !!row.project,
        hasTaskDescription: !!row.taskDescription
      });
      return { success: false, error: 'Row is incomplete' };
    }
    
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
      date: row.date,
      timeIn: row.timeIn,
      timeOut: row.timeOut,
      project: row.project,
      tool: row.tool ?? null,
      chargeCode: row.chargeCode ?? null,
      taskDescription: row.taskDescription
    };
    
    if (row.id !== undefined) {
      draftData.id = row.id;
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

