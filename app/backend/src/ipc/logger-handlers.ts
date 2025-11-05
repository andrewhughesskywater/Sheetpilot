/**
 * @fileoverview Logger IPC Handlers
 * 
 * Handles IPC communication for renderer logging bridge.
 * Routes renderer logs to main process logger.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { ipcMain } from 'electron';
import { ipcLogger } from '../../../shared/logger';

/**
 * Register all logger-related IPC handlers
 */
export function registerLoggerHandlers(): void {
  
  // Renderer logging bridge - route renderer logs to main process logger
  ipcMain.on('logger:error', (_event, message: string, data?: unknown) => {
    ipcLogger.error(message, data);
  });

  ipcMain.on('logger:warn', (_event, message: string, data?: unknown) => {
    ipcLogger.warn(message, data);
  });

  ipcMain.on('logger:info', (_event, message: string, data?: unknown) => {
    ipcLogger.info(message, data);
  });

  ipcMain.on('logger:verbose', (_event, message: string, data?: unknown) => {
    ipcLogger.verbose(message, data);
  });

  ipcMain.on('logger:debug', (_event, message: string, data?: unknown) => {
    ipcLogger.debug(message, data);
  });

  // User action tracking
  ipcMain.on('logger:user-action', (_event, action: string, data?: unknown) => {
    ipcLogger.info(`User action: ${action}`, data);
  });
}


