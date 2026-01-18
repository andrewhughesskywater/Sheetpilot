/**
 * @fileoverview Authentication IPC Handlers
 * 
 * Handles IPC communication for user authentication and session management.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { ipcMain } from 'electron';
import { ipcLogger, appLogger } from '@sheetpilot/shared/logger';
import { isTrustedIpcSender } from './handlers/timesheet/main-window';
import {
  createSession,
  validateSession,
  clearSession,
  clearUserSessions,
} from '@/models';
import { validateInput } from '@/validation/validate-ipc-input';
import {
  validateSessionSchema,
  logoutSchema,
  getCurrentSessionSchema,
} from '@/validation/ipc-schemas';
import {
  buildLoginError,
  ensureUserCredentials,
  getValidatedLoginPayload,
  isAdminLogin,
  type LoginResponse,
} from './auth-helpers';

// Admin credentials from environment variables
// For production: Set SHEETPILOT_ADMIN_USERNAME and SHEETPILOT_ADMIN_PASSWORD to override defaults
const ADMIN_USERNAME = process.env['SHEETPILOT_ADMIN_USERNAME'] || 'admin';
const ADMIN_PASSWORD = process.env['SHEETPILOT_ADMIN_PASSWORD'] || 'SWFL_admin';

if (ADMIN_PASSWORD === 'SWFL_admin') {
  appLogger.info('Using default admin credentials', {
    message: 'Set SHEETPILOT_ADMIN_PASSWORD environment variable to use custom admin password'
  });
}


/**
 * Register all authentication-related IPC handlers
 */
export function registerAuthHandlers(): void {
  ipcLogger.verbose('Registering authentication IPC handlers');
  
  // Handler for ping (connectivity test)
  ipcMain.handle('ping', async (event, message?: string) => {
    if (!isTrustedIpcSender(event)) {
      return 'Could not respond to ping: unauthorized request';
    }
    ipcLogger.debug('Ping handler called', { message });
    return `pong: ${message}`;
  });
  ipcLogger.verbose('Registered handler: ping');
  
  // Handler for user login
  ipcMain.handle(
    'auth:login',
    async (
      event,
      email: string,
      password: string,
      stayLoggedIn: boolean
    ): Promise<LoginResponse> => {
      if (!isTrustedIpcSender(event)) {
        return buildLoginError('Could not login: unauthorized request');
      }
      ipcLogger.debug('Login handler called', { email });

      const validation = getValidatedLoginPayload(
        email,
        password,
        stayLoggedIn
      );
      if (!validation.success) {
        return buildLoginError(validation.error);
      }

      const validatedData = validation.data;
      ipcLogger.audit('login-attempt', 'User attempting login', {
        email: validatedData.email,
      });

      try {
        const isAdmin = isAdminLogin(
          validatedData,
          ADMIN_USERNAME,
          ADMIN_PASSWORD
        );
        if (!isAdmin) {
          const credentialError = ensureUserCredentials(validatedData);
          if (credentialError) {
            return buildLoginError(credentialError);
          }
        }

        const sessionToken = createSession(
          validatedData.email,
          validatedData.stayLoggedIn,
          isAdmin
        );

        ipcLogger.info('Login successful', {
          email: validatedData.email,
          isAdmin,
        });
        return {
          success: true,
          token: sessionToken,
          isAdmin,
        };
      } catch (err: unknown) {
        ipcLogger.error('Could not login', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        return buildLoginError(errorMessage);
      }
    }
  );
  ipcLogger.verbose('Registered handler: auth:login');

  // Handler for session validation
  ipcMain.handle('auth:validateSession', async (event, token: string) => {
    if (!isTrustedIpcSender(event)) {
      return { valid: false };
    }
    // Validate input using Zod schema
    const validation = validateInput(validateSessionSchema, { token }, 'auth:validateSession');
    if (!validation.success) {
      return { valid: false };
    }
    
    const validatedData = validation.data!;

    try {
      const result = validateSession(validatedData.token);
      return result;
    } catch (err: unknown) {
      ipcLogger.error('Could not validate session', err);
      return { valid: false };
    }
  });
  ipcLogger.verbose('Registered handler: auth:validateSession');

  // Handler for logout
  ipcMain.handle('auth:logout', async (event, token: string) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not logout: unauthorized request' };
    }
    // Validate input using Zod schema
    const validation = validateInput(logoutSchema, { token }, 'auth:logout');
    if (!validation.success) {
      return { success: false, error: validation.error };
    }
    
    const validatedData = validation.data!;
    ipcLogger.audit('logout', 'User logging out', { token: validatedData.token.substring(0, 8) + '...' });
    
    try {
      // Get session info before clearing
      const session = validateSession(validatedData.token);
      if (session.valid && session.email) {
        clearUserSessions(session.email);
        ipcLogger.info('Logout successful', { email: session.email });
      } else {
        clearSession(validatedData.token);
      }
      
      return { success: true };
    } catch (err: unknown) {
      ipcLogger.error('Could not logout', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcLogger.verbose('Registered handler: auth:logout');

  // Handler for getting current session
  ipcMain.handle('auth:getCurrentSession', async (event, token: string) => {
    if (!isTrustedIpcSender(event)) {
      return null;
    }
    // Validate input using Zod schema
    const validation = validateInput(getCurrentSessionSchema, { token }, 'auth:getCurrentSession');
    if (!validation.success) {
      return null;
    }
    
    const validatedData = validation.data!;

    try {
      const session = validateSession(validatedData.token);
      if (session.valid && session.email) {
        return {
          email: session.email,
          token: validatedData.token,
          isAdmin: session.isAdmin || false
        };
      }
      return null;
    } catch (err: unknown) {
      ipcLogger.error('Could not get current session', err);
      return null;
    }
  });
  ipcLogger.verbose('Registered handler: auth:getCurrentSession');
  ipcLogger.verbose('All authentication handlers registered successfully');
}


