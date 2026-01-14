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
import { isTrustedIpcSender } from './handlers/timesheet/main-window';

/**
 * Register all logger-related IPC handlers
 */
export function registerLoggerHandlers(): void {
  
  // Renderer logging bridge - route renderer logs to main process logger
  ipcMain.on('logger:error', (event, message: string, data?: unknown) => {
    if (!isTrustedIpcSender(event)) return;
    ipcLogger.error(message, data);
  });

  ipcMain.on('logger:warn', (event, message: string, data?: unknown) => {
    if (!isTrustedIpcSender(event)) return;
    ipcLogger.warn(message, data);
  });

  ipcMain.on('logger:info', (event, message: string, data?: unknown) => {
    if (!isTrustedIpcSender(event)) return;
    ipcLogger.info(message, data);
  });

  ipcMain.on('logger:verbose', (event, message: string, data?: unknown) => {
    if (!isTrustedIpcSender(event)) return;
    ipcLogger.verbose(message, data);
  });

  ipcMain.on('logger:debug', (event, message: string, data?: unknown) => {
    if (!isTrustedIpcSender(event)) return;
    ipcLogger.debug(message, data);
  });

  // User action tracking
  ipcMain.on('logger:user-action', (event, action: string, data?: unknown) => {
    if (!isTrustedIpcSender(event)) return;
    ipcLogger.info(`User action: ${action}`, data);
  });
}


