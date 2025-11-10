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
import { ipcLogger, appLogger } from '../../../shared/logger';
import { 
  storeCredentials,
  createSession, 
  validateSession, 
  clearSession, 
  clearUserSessions 
} from '../services/database';
import { validateInput } from '../validation/validate-ipc-input';
import { 
  loginSchema,
  validateSessionSchema,
  logoutSchema,
  getCurrentSessionSchema
} from '../validation/ipc-schemas';

// Admin credentials from environment variables
// For production: Set SHEETPILOT_ADMIN_USERNAME and SHEETPILOT_ADMIN_PASSWORD
const ADMIN_USERNAME = process.env['SHEETPILOT_ADMIN_USERNAME'] || 'Admin';
const ADMIN_PASSWORD = process.env['SHEETPILOT_ADMIN_PASSWORD'];

if (!ADMIN_PASSWORD) {
  appLogger.warn('Admin password not configured', {
    message: 'Set SHEETPILOT_ADMIN_PASSWORD environment variable for admin access',
    security: 'Admin login will be disabled'
  });
}

/**
 * Register all authentication-related IPC handlers
 */
export function registerAuthHandlers(): void {
  console.log('[Auth Handlers] Registering authentication IPC handlers');
  
  // Handler for ping (connectivity test)
  ipcMain.handle('ping', async (_event, message?: string) => {
    console.log('[Auth Handlers] ping handler called');
    return `pong: ${message}`;
  });
  console.log('[Auth Handlers] Registered handler: ping');
  
  // Handler for user login
  ipcMain.handle('auth:login', async (_event, email: string, password: string, stayLoggedIn: boolean) => {
    console.log('[Auth Handlers] auth:login handler called');

    // Validate input using Zod schema
    const validation = validateInput(loginSchema, { email, password, stayLoggedIn }, 'auth:login');
    if (!validation.success) {
      return { success: false, error: validation.error };
    }
    
    const validatedData = validation.data!;
    ipcLogger.audit('login-attempt', 'User attempting login', { email: validatedData.email });
    
    try {
      let isAdmin = false;
      
      // Check if this is an admin login
      if (ADMIN_PASSWORD && validatedData.email === ADMIN_USERNAME && validatedData.password === ADMIN_PASSWORD) {
        isAdmin = true;
        ipcLogger.info('Admin login successful', { email: validatedData.email });
      } else {
        // For regular users, store credentials (service: 'smartsheet')
        ipcLogger.verbose('Storing user credentials', { email: validatedData.email });
        const storeResult = storeCredentials('smartsheet', validatedData.email, validatedData.password);
        if (!storeResult.success) {
          return { success: false, error: storeResult.message };
        }
      }

      // Create session
      const sessionToken = createSession(validatedData.email, validatedData.stayLoggedIn, isAdmin);
      
      ipcLogger.info('Login successful', { email: validatedData.email, isAdmin });
      return {
        success: true,
        token: sessionToken,
        isAdmin
      };
    } catch (err: unknown) {
      ipcLogger.error('Could not login', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });
  console.log('[Auth Handlers] Registered handler: auth:login');

  // Handler for session validation
  ipcMain.handle('auth:validateSession', async (_event, token: string) => {
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
  console.log('[Auth Handlers] Registered handler: auth:validateSession');

  // Handler for logout
  ipcMain.handle('auth:logout', async (_event, token: string) => {
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
  console.log('[Auth Handlers] Registered handler: auth:logout');

  // Handler for getting current session
  ipcMain.handle('auth:getCurrentSession', async (_event, token: string) => {
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
  console.log('[Auth Handlers] Registered handler: auth:getCurrentSession');
  console.log('[Auth Handlers] All authentication handlers registered successfully');
}


