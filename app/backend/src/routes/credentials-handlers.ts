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
import { ipcLogger } from '@sheetpilot/shared/logger';
import { isTrustedIpcSender } from './handlers/timesheet/main-window';
import { 
  storeCredentials, 
  listCredentials, 
  deleteCredentials 
} from '@/models';
import { CredentialsStorageError } from '@sheetpilot/shared/errors';
import { validateInput } from '@/validation/validate-ipc-input';
import { 
  storeCredentialsSchema,
  deleteCredentialsSchema 
} from '@/validation/ipc-schemas';

/**
 * Register all credentials-related IPC handlers
 */
export function registerCredentialsHandlers(): void {
  
  // Handler for storing credentials
  ipcMain.handle('credentials:store', async (event, service: string, email: string, password: string) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, message: 'Could not store credentials: unauthorized request', changes: 0 };
    }

    // Validate input using Zod schema
    const validation = validateInput(storeCredentialsSchema, { service, email, password }, 'credentials:store');
    if (!validation.success) {
      return { success: false, message: validation.error, changes: 0 };
    }
    
    const validatedData = validation.data!;
    ipcLogger.audit('store-credentials', 'User storing credentials', { service: validatedData.service, email: validatedData.email });
    
    try {
      const result = storeCredentials(validatedData.service, validatedData.email, validatedData.password);
      ipcLogger.info('Credentials stored successfully', { service: validatedData.service, email: validatedData.email, changes: result.changes });
      return result;
    } catch (err: unknown) {
      // Check if this is a credentials error for audit logging
      const isCredentialsError = err instanceof Error && err.name.includes('Credentials');
      
      if (isCredentialsError) {
        ipcLogger.security('credentials-storage-error', 'Could not store credentials', { service: validatedData.service, error: err });
      } else {
        ipcLogger.error('Could not store credentials', err);
      }
      
      throw new CredentialsStorageError(validatedData.service, {
        error: err instanceof Error ? err.message : String(err),
        originalError: err instanceof Error ? err.name : 'Unknown'
      });
    }
  });

  // Handler for listing credentials
  ipcMain.handle('credentials:list', async (event) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not list credentials: unauthorized request', credentials: [] };
    }
    try {
      const credentials = listCredentials();
      return { success: true, credentials };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage, credentials: [] };
    }
  });

  // Handler for deleting credentials
  ipcMain.handle('credentials:delete', async (event, service: string) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, message: 'Could not delete credentials: unauthorized request', changes: 0 };
    }
    // Validate input using Zod schema
    const validation = validateInput(deleteCredentialsSchema, { service }, 'credentials:delete');
    if (!validation.success) {
      return { success: false, message: validation.error, changes: 0 };
    }
    
    const validatedData = validation.data!;
    ipcLogger.audit('delete-credentials', 'User deleting credentials', { service: validatedData.service });
    
    try {
      const result = deleteCredentials(validatedData.service);
      ipcLogger.info('Credentials deleted', { service: validatedData.service, changes: result.changes });
      return result;
    } catch (err: unknown) {
      ipcLogger.error('Could not delete credentials', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, message: errorMessage, changes: 0 };
    }
  });
}


