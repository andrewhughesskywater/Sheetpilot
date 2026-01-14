import type { BrowserWindow } from 'electron';
import { setMainWindow } from './main-window';
import { registerTimesheetDraftHandlers } from './drafts';
import { registerTimesheetSubmissionHandlers } from './submission';
import { registerTimesheetDevHandlers } from './dev';
import { registerTimesheetResetHandlers } from './reset';
import { registerTimesheetExportHandlers } from './export';

export function registerTimesheetHandlers(): void {
  registerTimesheetSubmissionHandlers();
  registerTimesheetDraftHandlers();
  registerTimesheetDevHandlers();
  registerTimesheetResetHandlers();
  registerTimesheetExportHandlers();
}

export function setMainWindowRef(window: BrowserWindow | null): void {
  setMainWindow(window);
}


