/**
 * @fileoverview Timesheet IPC Handlers (Compatibility Wrapper)
 *
 * This file remains to keep stable import paths for existing modules and tests.
 * The actual implementation lives under `ipc/handlers/timesheet/*`.
 */

import type { BrowserWindow } from 'electron';
import { registerTimesheetHandlers as registerTimesheetHandlersInternal, setMainWindowRef } from './handlers/timesheet';

export function setMainWindow(window: BrowserWindow | null): void {
  setMainWindowRef(window);
}

export function registerTimesheetHandlers(): void {
  registerTimesheetHandlersInternal();
}

