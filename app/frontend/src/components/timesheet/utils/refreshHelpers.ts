import { logError, logInfo, logWarn } from '../../../services/ipc/logger';
import { loadDraft as loadDraftIpc, resetInProgress as resetInProgressIpc } from '../../../services/ipc/timesheet';
import type { TimesheetRow } from '../timesheet.schema';

async function handleResetInProgress(): Promise<void> {
  const resetResult = await resetInProgressIpc();
  if (resetResult.success) {
    logInfo('Reset in-progress entries', { count: resetResult.count || 0 });
  } else if (resetResult.error) {
    logWarn('Could not reset in-progress entries', { error: resetResult.error });
  }
}

function prepareRowsWithBlank(draftData: TimesheetRow[]): TimesheetRow[] {
  if (draftData.length > 0 && Object.keys(draftData[0] || {}).length > 0) {
    return [...draftData, {} as TimesheetRow];
  }
  return [{} as TimesheetRow];
}

async function handleLoadDraft(setTimesheetDraftData: (rows: TimesheetRow[]) => void): Promise<void> {
  const response = await loadDraftIpc();
  if (response?.success) {
    const draftData = (response.entries || []) as TimesheetRow[];
    const rowsWithBlank = prepareRowsWithBlank(draftData);
    setTimesheetDraftData(rowsWithBlank);
    logInfo('Table refreshed successfully', { count: draftData.length });
  } else {
    logWarn('Refresh failed', { error: response?.error });
    logWarn('Could not load table data', { error: response?.error || 'Unknown error' });
  }
}

export function createRefreshHandler(setTimesheetDraftData: (rows: TimesheetRow[]) => void) {
  return async () => {
    logInfo('Refresh button clicked - resetting in-progress entries and reloading table');
    try {
      await handleResetInProgress();
      await handleLoadDraft(setTimesheetDraftData);
    } catch (error) {
      logError('Could not refresh table', { error: error instanceof Error ? error.message : String(error) });
    }
  };
}
