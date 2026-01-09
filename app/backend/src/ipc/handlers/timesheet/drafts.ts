import { ipcMain } from 'electron';
import { isTrustedIpcSender } from './main-window';
import { ipcLogger } from '../../utils/logger';
import {
  deleteDraftRequest,
  loadDraftByIdRequest,
  loadDraftRequest,
  saveDraftRequest,
  type SaveDraftInput
} from '../../services/timesheet-drafts-service';

export function registerTimesheetDraftHandlers(): void {
  ipcMain.handle(
    'timesheet:saveDraft',
    async (
      event,
      row: SaveDraftInput
    ) => {
      if (!isTrustedIpcSender(event)) {
        return { success: false, error: 'Could not save draft: unauthorized request' };
      }
      return saveDraftRequest(row);
    }
  );

  ipcMain.handle('timesheet:deleteDraft', async (event, id: number) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not delete draft: unauthorized request' };
    }
    return deleteDraftRequest(id);
  });

  ipcMain.handle('timesheet:loadDraft', async (event) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not load draft: unauthorized request', entries: [] };
    }
    return loadDraftRequest();
  });

  ipcMain.handle('timesheet:loadDraftById', async (event, id: number) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not load draft by ID: unauthorized request' };
    }
    return loadDraftByIdRequest(id);
  });

  ipcLogger.verbose('Timesheet draft handlers registered');
}


