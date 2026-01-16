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
} from '@/models';
import { validateInput } from '@/validation/validate-ipc-input';
import { 
  loginSchema,
  validateSessionSchema,
  logoutSchema,
  getCurrentSessionSchema
} from '@/validation/ipc-schemas';

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

type LoginPayload = {
  email: string;
  password: string;
  stayLoggedIn: boolean;
};

type LoginResponse = {
  success: boolean;
  error?: string;
  token?: string;
  isAdmin?: boolean;
};

const buildLoginError = (error: string): LoginResponse => ({
  success: false,
  error,
});

const getValidatedLoginPayload = (
  email: string,
  password: string,
  stayLoggedIn: boolean
): { success: true; data: LoginPayload } | { success: false; error: string } => {
  const validation = validateInput(
    loginSchema,
    { email, password, stayLoggedIn },
    'auth:login'
  );
  if (!validation.success) {
    return { success: false, error: validation.error };
  }
  return { success: true, data: validation.data! };
};

const isAdminLogin = (payload: LoginPayload): boolean => {
  if (!ADMIN_PASSWORD) {
    return false;
  }
  const isAdmin =
    payload.email === ADMIN_USERNAME && payload.password === ADMIN_PASSWORD;
  if (isAdmin) {
    ipcLogger.info('Admin login successful', { email: payload.email });
  }
  return isAdmin;
};

const getCredentialMismatchError = (
  storedEmail: string,
  providedEmail: string
): string | null => {
  if (storedEmail === providedEmail) {
    return null;
  }
  ipcLogger.warn('Login email mismatch', {
    providedEmail,
    storedEmail,
  });
  return `Credentials are stored for ${storedEmail}. Use that email or clear credentials in Settings.`;
};

const getPasswordMismatchError = (
  storedPassword: string,
  providedPassword: string,
  email: string
): string | null => {
  if (storedPassword === providedPassword) {
    return null;
  }
  ipcLogger.warn('Login password mismatch', { email });
  return 'Incorrect password. Please try again.';
};

const validateReturningUser = (
  storedEmail: string,
  storedPassword: string,
  payload: LoginPayload
): string | null => {
  const emailError = getCredentialMismatchError(
    storedEmail,
    payload.email
  );
  if (emailError) {
    return emailError;
  }
  const passwordError = getPasswordMismatchError(
    storedPassword,
    payload.password,
    payload.email
  );
  if (passwordError) {
    return passwordError;
  }
  ipcLogger.verbose('Password verified for returning user', {
    email: payload.email,
  });
  return null;
};

const storeNewUserCredentials = (payload: LoginPayload): string | null => {
  ipcLogger.verbose('Storing credentials for new user', {
    email: payload.email,
  });
  const storeResult = storeCredentials(
    'smartsheet',
    payload.email,
    payload.password
  );
  if (!storeResult.success) {
    return storeResult.message;
  }
  return null;
};

const ensureUserCredentials = (payload: LoginPayload): string | null => {
  const existingCredentials = getCredentials('smartsheet');
  if (existingCredentials) {
    return validateReturningUser(
      existingCredentials.email,
      existingCredentials.password,
      payload
    );
  }
  return storeNewUserCredentials(payload);
};

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
        const isAdmin = isAdminLogin(validatedData);
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


