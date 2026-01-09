import type { BrowserWindow } from 'electron';

import { registerTimesheetDevHandlers } from './dev';
import { registerTimesheetDraftHandlers } from './drafts';
import { registerTimesheetExportHandlers } from './export';
import { setMainWindow } from './main-window';
import { registerTimesheetResetHandlers } from './reset';
import { registerTimesheetSubmissionHandlers } from './submission';

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
