import { ipcMain } from 'electron';
import { ipcLogger } from '@sheetpilot/shared/logger';
import {
  handleDeleteDraft,
  handleLoadDraft,
  handleLoadDraftById,
  handleSaveDraft,
} from '@/routes/handlers/timesheet/drafts.handlers';

export function registerTimesheetDraftHandlers(): void {
  ipcMain.handle('timesheet:saveDraft', handleSaveDraft);
  ipcMain.handle('timesheet:deleteDraft', handleDeleteDraft);
  ipcMain.handle('timesheet:loadDraft', handleLoadDraft);
  ipcMain.handle('timesheet:loadDraftById', handleLoadDraftById);

  ipcLogger.verbose('Timesheet draft handlers registered');
}


