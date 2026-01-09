import { ipcMain } from 'electron';
import { ipcLogger } from '../../utils/logger';
import { cancelTimesheetSubmission, submitTimesheetWorkflow } from '../../../services/timesheet/submission-workflow';
import { emitSubmissionProgress } from './main-window';
import { isTrustedIpcSender } from './main-window';

export function registerTimesheetSubmissionHandlers(): void {
  ipcMain.handle('timesheet:submit', async (event, token: string, useMockWebsite?: boolean) => {
    if (!isTrustedIpcSender(event)) {
      return { error: 'Could not submit timesheets: unauthorized request' };
    }
    const result = await submitTimesheetWorkflow({
      token,
      ...(useMockWebsite !== undefined ? { useMockWebsite } : {}),
      onProgress: (percent, message, meta) => {
        const pendingCount = meta.pendingIds.length;
        const safePercent = Math.min(100, Math.max(0, percent));
        const progressData = {
          percent: safePercent,
          current: Math.floor((safePercent / 100) * pendingCount),
          total: pendingCount,
          message
        };
        emitSubmissionProgress(progressData);
      }
    });

    return result;
  });

  ipcMain.handle('timesheet:cancel', async (event) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not cancel submission: unauthorized request' };
    }
    return cancelTimesheetSubmission();
  });

  ipcLogger.verbose('Timesheet submission handlers registered');
}


