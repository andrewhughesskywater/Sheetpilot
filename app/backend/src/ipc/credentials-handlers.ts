/**
 * @fileoverview Credentials IPC Handlers
 *
 * Handles IPC communication for credential storage and retrieval.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { ipcMain } from 'electron';

import { isTrustedIpcSender } from './handlers/timesheet/main-window';
import {
  deleteCredentialsRequest,
  listCredentialsRequest,
  storeCredentialsRequest,
} from './services/credentials-service';

/**
 * Register all credentials-related IPC handlers
 */
export function registerCredentialsHandlers(): void {
  ipcMain.handle('credentials:store', async (event, service: string, email: string, password: string) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, message: 'Could not store credentials: unauthorized request', changes: 0 };
    }
    const result = storeCredentialsRequest(service, email, password);
    if (!result.success && result.error) {
      throw result.error;
    }
    return result;
  });

  ipcMain.handle('credentials:list', async (event) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not list credentials: unauthorized request', credentials: [] };
    }
    return listCredentialsRequest();
  });

  ipcMain.handle('credentials:delete', async (event, service: string) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, message: 'Could not delete credentials: unauthorized request', changes: 0 };
    }
    return deleteCredentialsRequest(service);
  });
}
