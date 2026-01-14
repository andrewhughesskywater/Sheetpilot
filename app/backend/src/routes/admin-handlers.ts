/**
 * @fileoverview Admin IPC Handlers
 * 
 * Handles IPC communication for administrative operations.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { ipcMain } from 'electron';
import { ipcLogger } from '@sheetpilot/shared/logger';
import { isTrustedIpcSender } from './handlers/timesheet/main-window';
import { 
  validateSession,
  clearAllCredentials,
  rebuildDatabase
} from '@/models';
import { validateInput } from '@/validation/validate-ipc-input';
import { adminTokenSchema } from '@/validation/ipc-schemas';

/**
 * Register all admin-related IPC handlers
 */
export function registerAdminHandlers(): void {
  
  // Handler for admin to clear all credentials
  ipcMain.handle('admin:clearCredentials', async (event, token: string) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not clear credentials: unauthorized request' };
    }
    // Validate input using Zod schema
    const validation = validateInput(adminTokenSchema, { token }, 'admin:clearCredentials');
    if (!validation.success) {
      return { success: false, error: validation.error };
    }
    
    const validatedData = validation.data!;
    const session = validateSession(validatedData.token);
    
    if (!session.valid || !session.isAdmin) {
      ipcLogger.security('admin-action-denied', 'Unauthorized admin action attempted', { 
        token: validatedData.token.substring(0, 8) + '...' 
      });
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    ipcLogger.audit('admin-clear-credentials', 'Admin clearing all credentials', { email: session.email });
    
    try {
      clearAllCredentials();
      ipcLogger.info('All credentials cleared by admin', { email: session.email });
      return { success: true };
    } catch (err: unknown) {
      ipcLogger.error('Could not clear credentials', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Handler for admin to rebuild database
  ipcMain.handle('admin:rebuildDatabase', async (event, token: string) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not rebuild database: unauthorized request' };
    }
    // Validate input using Zod schema
    const validation = validateInput(adminTokenSchema, { token }, 'admin:rebuildDatabase');
    if (!validation.success) {
      return { success: false, error: validation.error };
    }
    
    const validatedData = validation.data!;
    const session = validateSession(validatedData.token);
    
    if (!session.valid || !session.isAdmin) {
      ipcLogger.security('admin-action-denied', 'Unauthorized admin action attempted', { 
        token: validatedData.token.substring(0, 8) + '...' 
      });
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    ipcLogger.audit('admin-rebuild-database', 'Admin rebuilding database', { email: session.email });
    
    try {
      rebuildDatabase();
      ipcLogger.info('Database rebuilt by admin', { email: session.email });
      return { success: true };
    } catch (err: unknown) {
      ipcLogger.error('Could not rebuild database', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}


