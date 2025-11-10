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
import { appLogger } from '../../../shared/logger';
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
  console.log('[IPC Registry] registerAllIPCHandlers called');
  appLogger.verbose('Starting IPC handler registration', { hasMainWindow: !!mainWindow });
  
  // Set main window reference for timesheet handlers (progress updates)
  if (mainWindow) {
    appLogger.verbose('Setting main window reference for timesheet handlers');
    setMainWindow(mainWindow);
  }
  
  // Register all handler modules with verbose logging
  try {
    console.log('[IPC Registry] Registering auth handlers');
    appLogger.verbose('Registering auth handlers');
    registerAuthHandlers();
    appLogger.verbose('Auth handlers registered successfully');
    
    console.log('[IPC Registry] Registering credentials handlers');
    appLogger.verbose('Registering credentials handlers');
    registerCredentialsHandlers();
    appLogger.verbose('Credentials handlers registered successfully');
    
    console.log('[IPC Registry] Registering timesheet handlers');
    appLogger.verbose('Registering timesheet handlers');
    registerTimesheetHandlers();
    appLogger.verbose('Timesheet handlers registered successfully');
    
    console.log('[IPC Registry] Registering admin handlers');
    appLogger.verbose('Registering admin handlers');
    registerAdminHandlers();
    appLogger.verbose('Admin handlers registered successfully');
    
    console.log('[IPC Registry] Registering database handlers');
    appLogger.verbose('Registering database handlers');
    registerDatabaseHandlers();
    appLogger.verbose('Database handlers registered successfully');
    
    console.log('[IPC Registry] Registering logs handlers');
    appLogger.verbose('Registering logs handlers');
    registerLogsHandlers();
    appLogger.verbose('Logs handlers registered successfully');
    
    console.log('[IPC Registry] Registering logger handlers');
    appLogger.verbose('Registering logger handlers');
    registerLoggerHandlers();
    appLogger.verbose('Logger handlers registered successfully');
    
    console.log('[IPC Registry] All IPC handlers registered');
    appLogger.info('All IPC handler modules registered successfully', { 
      modulesRegistered: [
        'auth', 
        'credentials', 
        'timesheet', 
        'admin', 
        'database', 
        'logs', 
        'logger'
      ]
    });
  } catch (err) {
    appLogger.error('Failed to register IPC handler module', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    throw err; // Re-throw to be caught by main.ts error handler
  }
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


