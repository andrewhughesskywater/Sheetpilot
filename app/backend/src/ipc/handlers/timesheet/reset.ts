import { ipcMain } from 'electron';
import { ipcLogger } from '@sheetpilot/shared/logger';
import { resetInProgressTimesheetEntries } from '../../../repositories';
import { isTrustedIpcSender } from './main-window';

export function registerTimesheetResetHandlers(): void {
  ipcMain.handle('timesheet:resetInProgress', async (event) => {
    const timer = ipcLogger.startTimer('reset-in-progress');
    if (!isTrustedIpcSender(event)) {
      timer.done({ outcome: 'error', reason: 'unauthorized' });
      return { success: false, error: 'Could not reset in-progress entries: unauthorized request' };
    }
    try {
      ipcLogger.info('Resetting in-progress entries to NULL status');
      const resetCount = resetInProgressTimesheetEntries();
      ipcLogger.info('Reset in-progress entries completed', { count: resetCount });
      timer.done({ count: resetCount });
      return { success: true, count: resetCount };
    } catch (err: unknown) {
      ipcLogger.error('Could not reset in-progress entries', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  ipcLogger.verbose('Timesheet reset handlers registered');
}


