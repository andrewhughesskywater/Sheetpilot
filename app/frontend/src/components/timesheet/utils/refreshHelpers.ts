import type { TimesheetRow } from '../timesheet.schema';
import { loadDraft as loadDraftIpc, resetInProgress as resetInProgressIpc } from '../../../services/ipc/timesheet';
import { logError, logInfo, logWarn } from '../../../services/ipc/logger';

export function createRefreshHandler(
  setTimesheetDraftData: (rows: TimesheetRow[]) => void
) {
  return async () => {
    logInfo('Refresh button clicked - resetting in-progress entries and reloading table');
    try {
      const resetResult = await resetInProgressIpc();
      if (resetResult.success) {
        logInfo('Reset in-progress entries', { count: resetResult.count || 0 });
        if (resetResult.count && resetResult.count > 0) {
          window.alert(`✅ Reset ${resetResult.count} in-progress ${resetResult.count === 1 ? 'entry' : 'entries'} to pending status.`);
        }
      } else if (resetResult.error) {
        logWarn('Could not reset in-progress entries', { error: resetResult.error });
      }

      const response = await loadDraftIpc();
      if (response?.success) {
        const draftData = (response.entries || []) as TimesheetRow[];
        const rowsWithBlank =
          draftData.length > 0 && Object.keys(draftData[0] || {}).length > 0 ? [...draftData, {} as TimesheetRow] : [{} as TimesheetRow];
        setTimesheetDraftData(rowsWithBlank);
        logInfo('Table refreshed successfully', { count: draftData.length });
      } else {
        logWarn('Refresh failed', { error: response?.error });
        window.alert(`⚠️ Could not load table data: ${response?.error || 'Unknown error'}`);
      }
    } catch (error) {
      logError('Could not refresh table', { error: error instanceof Error ? error.message : String(error) });
      window.alert(`❌ Could not refresh table: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}
