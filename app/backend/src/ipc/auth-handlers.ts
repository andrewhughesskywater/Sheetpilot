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
  storeCredentials,
  getCredentials,
  createSession, 
  validateSession, 
  clearSession, 
  clearUserSessions 
} from '../repositories';
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
  ipcMain.handle('auth:login', async (event, email: string, password: string, stayLoggedIn: boolean) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not login: unauthorized request' };
    }
    ipcLogger.debug('Login handler called', { email });

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
        // For regular users, check if credentials already exist
        const existingCredentials = getCredentials('smartsheet');
        
        if (existingCredentials) {
          // Returning user - verify password matches stored credentials
          if (existingCredentials.email !== validatedData.email) {
            ipcLogger.warn('Login email mismatch', { 
              providedEmail: validatedData.email,
              storedEmail: existingCredentials.email 
            });
            return { 
              success: false, 
              error: `Credentials are stored for ${existingCredentials.email}. Use that email or clear credentials in Settings.` 
            };
          }
          
          if (existingCredentials.password !== validatedData.password) {
            ipcLogger.warn('Login password mismatch', { email: validatedData.email });
            return { success: false, error: 'Incorrect password. Please try again.' };
          }
          
          ipcLogger.verbose('Password verified for returning user', { email: validatedData.email });
        } else {
          // New user - store credentials
          ipcLogger.verbose('Storing credentials for new user', { email: validatedData.email });
          const storeResult = storeCredentials('smartsheet', validatedData.email, validatedData.password);
          if (!storeResult.success) {
            return { success: false, error: storeResult.message };
          }
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


