import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { registerAuthHandlers } from '@/ipc/auth-handlers';
import * as repositories from '@/repositories';
// We use getCredentials from repositories in our mocks
import { ipcLogger as _ipcLogger } from '@sheetpilot/shared/logger';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('@/ipc/handlers/timesheet/main-window', () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

// Mock repositories
vi.mock('@/repositories', () => ({
  storeCredentials: vi.fn(),
  getCredentials: vi.fn(),
  createSession: vi.fn(),
  validateSession: vi.fn(),
  clearSession: vi.fn(),
  clearUserSessions: vi.fn(),
}));

// Mock logger
vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    verbose: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    audit: vi.fn(),
    error: vi.fn(),
  },
  appLogger: {
    warn: vi.fn(),
  },
}));

// Mock validation
vi.mock('@/validation/validate-ipc-input', () => ({
  validateInput: vi.fn((schema, data) => ({ success: true, data })),
}));

describe('auth-handlers', () => {
  const originalEnv = process.env;
  let handleCalls: Array<[string, (event: IpcMainInvokeEvent, ...args: any[]) => any]> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    handleCalls = [];

    // Capture handle calls
    vi.mocked(ipcMain.handle).mockImplementation(
      (channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => any) => {
        handleCalls.push([channel, handler]);
        return undefined as never;
      }
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const getHandler = (channel: string) => {
    const entry = handleCalls.find(([ch]) => ch === channel);
    return entry?.[1];
  };

  describe('registerAuthHandlers', () => {
    it('should register all auth handlers', () => {
      registerAuthHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('ping', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('auth:login', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('auth:validateSession', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('auth:logout', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('auth:getCurrentSession', expect.any(Function));
    });
  });

  describe('ping handler', () => {
    it('should return pong with message', async () => {
      registerAuthHandlers();

      const handler = getHandler('ping') as (event: unknown, message?: string) => Promise<string>;

      const result = await handler({}, 'test');
      expect(result).toBe('pong: test');
    });
  });

  describe('auth:login handler', () => {
    it('should login regular user successfully', async () => {
      // Mock getCredentials to return null (new user scenario)
      vi.mocked(repositories.getCredentials).mockReturnValue(null);
      vi.mocked(repositories.storeCredentials).mockReturnValue({
        success: true,
        message: 'Stored',
        changes: 1,
      });
      vi.mocked(repositories.createSession).mockReturnValue('test-token');

      registerAuthHandlers();

      const handler = getHandler('auth:login') as (
        event: unknown,
        email: string,
        password: string,
        stayLoggedIn: boolean
      ) => Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }>;

      const result = await handler({}, 'user@example.com', 'password', false);

      expect(result.success).toBe(true);
      expect(result.token).toBe('test-token');
      expect(result.isAdmin).toBe(false);
      expect(repositories.storeCredentials).toHaveBeenCalledWith('smartsheet', 'user@example.com', 'password');
    });

    it('should login admin user successfully', async () => {
      // Set env vars before importing/registering
      const originalAdminUser = process.env['SHEETPILOT_ADMIN_USERNAME'];
      const originalAdminPass = process.env['SHEETPILOT_ADMIN_PASSWORD'];

      process.env['SHEETPILOT_ADMIN_USERNAME'] = 'Admin';
      process.env['SHEETPILOT_ADMIN_PASSWORD'] = 'admin123';

      vi.mocked(repositories.createSession).mockReturnValue('admin-token');

      // Re-import the module to pick up new env vars
      vi.resetModules();
      const { registerAuthHandlers: registerAuth } = await import('../../src/ipc/auth-handlers');

      // Clear and setup fresh handler capture
      handleCalls = [];
      vi.mocked(ipcMain.handle).mockImplementation((channel: string, listener: (event: any, ...args: any[]) => any) => {
        handleCalls.push([channel, listener]);
        return undefined as never;
      });

      registerAuth();

      const handler = getHandler('auth:login') as (
        event: unknown,
        email: string,
        password: string,
        stayLoggedIn: boolean
      ) => Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }>;

      const result = await handler({}, 'Admin', 'admin123', false);

      expect(result.success).toBe(true);
      expect(result.isAdmin).toBe(true);
      expect(repositories.storeCredentials).not.toHaveBeenCalled();

      // Restore env vars
      if (originalAdminUser) process.env['SHEETPILOT_ADMIN_USERNAME'] = originalAdminUser;
      else delete process.env['SHEETPILOT_ADMIN_USERNAME'];
      if (originalAdminPass) process.env['SHEETPILOT_ADMIN_PASSWORD'] = originalAdminPass;
      else delete process.env['SHEETPILOT_ADMIN_PASSWORD'];
    });

    it('should handle credential storage failure', async () => {
      // Mock getCredentials to return null (new user scenario)
      vi.mocked(repositories.getCredentials).mockReturnValue(null);
      vi.mocked(repositories.storeCredentials).mockReturnValue({
        success: false,
        message: 'Storage failed',
        changes: 0,
      });

      registerAuthHandlers();

      const handler = getHandler('auth:login') as (
        event: unknown,
        email: string,
        password: string,
        stayLoggedIn: boolean
      ) => Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }>;

      const result = await handler({}, 'user@example.com', 'password', false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage failed');
    });

    it('should handle errors gracefully', async () => {
      // Mock getCredentials to return null (new user scenario)
      vi.mocked(repositories.getCredentials).mockReturnValue(null);
      vi.mocked(repositories.storeCredentials).mockImplementation(() => {
        throw new Error('Database error');
      });

      registerAuthHandlers();

      const handler = getHandler('auth:login') as (
        event: unknown,
        email: string,
        password: string,
        stayLoggedIn: boolean
      ) => Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }>;

      const result = await handler({}, 'user@example.com', 'password', false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('auth:validateSession handler', () => {
    it('should validate valid session', async () => {
      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false,
      });

      registerAuthHandlers();

      const handler = getHandler('auth:validateSession') as (
        event: unknown,
        token: string
      ) => Promise<{ valid: boolean; email?: string; isAdmin?: boolean }>;

      const result = await handler({}, 'test-token');

      expect(result.valid).toBe(true);
      expect(result.email).toBe('user@example.com');
    });

    it('should invalidate invalid session', async () => {
      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: false,
      });

      registerAuthHandlers();

      const handler = getHandler('auth:validateSession') as (
        event: unknown,
        token: string
      ) => Promise<{ valid: boolean; email?: string; isAdmin?: boolean }>;

      const result = await handler({}, 'invalid-token');

      expect(result.valid).toBe(false);
    });
  });

  describe('auth:logout handler', () => {
    it('should logout user successfully', async () => {
      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false,
      });
      vi.mocked(repositories.clearSession).mockReturnValue(undefined);
      vi.mocked(repositories.clearUserSessions).mockReturnValue(undefined);

      registerAuthHandlers();

      const handler = getHandler('auth:logout') as (event: unknown, token: string) => Promise<{ success: boolean }>;

      const result = await handler({}, 'test-token');

      expect(result.success).toBe(true);
    });

    it('should handle logout errors', async () => {
      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false,
      });
      vi.mocked(repositories.clearUserSessions).mockImplementation(() => {
        throw new Error('Logout failed');
      });

      registerAuthHandlers();

      const handler = getHandler('auth:logout') as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Logout failed');
    });
  });

  describe('auth:getCurrentSession handler', () => {
    it('should get current session', async () => {
      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false,
      });

      registerAuthHandlers();

      const handler = getHandler('auth:getCurrentSession') as (
        event: unknown,
        token: string
      ) => Promise<{ email?: string; token?: string; isAdmin?: boolean } | null>;

      const result = await handler({}, 'test-token');

      expect(result).toBeDefined();
      expect(result?.email).toBe('user@example.com');
      expect(result?.isAdmin).toBe(false);
    });
  });
});
