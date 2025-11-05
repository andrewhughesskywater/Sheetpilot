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
import { ipcLogger } from '../../../shared/logger';
import { 
  storeCredentials, 
  getCredentials, 
  listCredentials, 
  deleteCredentials 
} from '../services/database';
import { 
  CredentialsNotFoundError,
  CredentialsStorageError,
  isAppError
} from '../../../shared/errors';
import { validateInput } from '../validation/validate-ipc-input';
import { 
  storeCredentialsSchema,
  getCredentialsSchema,
  deleteCredentialsSchema 
} from '../validation/ipc-schemas';

/**
 * Register all credentials-related IPC handlers
 */
export function registerCredentialsHandlers(): void {
  
  // Handler for storing credentials
  ipcMain.handle('credentials:store', async (_event, service: string, email: string, password: string) => {
    // Validate input using Zod schema
    const validation = validateInput(storeCredentialsSchema, { service, email, password }, 'credentials:store');
    if (!validation.success) {
      return { success: false, error: validation.error };
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

  // Handler for getting credentials
  ipcMain.handle('credentials:get', async (_event, service: string) => {
    // Validate input using Zod schema
    const validation = validateInput(getCredentialsSchema, { service }, 'credentials:get');
    if (!validation.success) {
      return { success: false, error: validation.error };
    }
    
    const validatedData = validation.data!;
    
    try {
      const credentials = getCredentials(validatedData.service);
      if (!credentials) {
        throw new CredentialsNotFoundError(validatedData.service);
      }
      return { success: true, credentials };
    } catch (err: unknown) {
      if (isAppError(err)) {
        ipcLogger.error('Credentials retrieval failed', {
          code: err.code,
          category: err.category,
          context: err.context
        });
        return { success: false, error: err.toUserMessage() };
      }
      
      const errorMessage = err instanceof Error ? err.message : String(err);
      ipcLogger.error('Could not retrieve credentials', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  // Handler for listing credentials
  ipcMain.handle('credentials:list', async () => {
    try {
      const credentials = listCredentials();
      return { success: true, credentials };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage, credentials: [] };
    }
  });

  // Handler for deleting credentials
  ipcMain.handle('credentials:delete', async (_event, service: string) => {
    // Validate input using Zod schema
    const validation = validateInput(deleteCredentialsSchema, { service }, 'credentials:delete');
    if (!validation.success) {
      return { success: false, error: validation.error };
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
      return { success: false, error: errorMessage, changes: 0 };
    }
  });
}


