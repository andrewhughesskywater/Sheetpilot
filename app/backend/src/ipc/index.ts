/**
 * @fileoverview IPC Handlers Registry
 * 
 * Central registry for all IPC handlers.
 * Import this module and call registerAllIPCHandlers() to register all handlers.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { BrowserWindow } from 'electron';
import { registerAuthHandlers } from './auth-handlers';
import { registerCredentialsHandlers } from './credentials-handlers';
import { registerTimesheetHandlers, setMainWindow } from './timesheet-handlers';
import { registerAdminHandlers } from './admin-handlers';
import { registerDatabaseHandlers } from './database-handlers';
import { registerLogsHandlers } from './logs-handlers';
import { registerLoggerHandlers } from './logger-handlers';

/**
 * Register all IPC handlers
 * Call this once during application initialization
 * 
 * @param mainWindow - Main browser window for sending events
 */
export function registerAllIPCHandlers(mainWindow?: BrowserWindow | null): void {
  // Set main window reference for timesheet handlers (progress updates)
  if (mainWindow) {
    setMainWindow(mainWindow);
  }
  
  // Register all handler modules
  registerAuthHandlers();
  registerCredentialsHandlers();
  registerTimesheetHandlers();
  registerAdminHandlers();
  registerDatabaseHandlers();
  registerLogsHandlers();
  registerLoggerHandlers();
}

// Export individual registration functions for testing
export {
  registerAuthHandlers,
  registerCredentialsHandlers,
  registerTimesheetHandlers,
  registerAdminHandlers,
  registerDatabaseHandlers,
  registerLogsHandlers,
  registerLoggerHandlers,
  setMainWindow
};


