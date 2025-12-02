import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerAuthHandlers } from '../../src/ipc/auth-handlers';
import * as repositories from '../../src/repositories';
import { ipcLogger } from '../../../shared/logger';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}));

// Mock repositories
vi.mock('../../src/repositories', () => ({
  storeCredentials: vi.fn(),
  createSession: vi.fn(),
  validateSession: vi.fn(),
  clearSession: vi.fn(),
  clearUserSessions: vi.fn()
}));

// Mock logger
vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    verbose: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    audit: vi.fn(),
    error: vi.fn()
  },
  appLogger: {
    warn: vi.fn()
  }
}));

// Mock validation
vi.mock('../../src/validation/validate-ipc-input', () => ({
  validateInput: vi.fn((schema, data) => ({ success: true, data }))
}));

describe('auth-handlers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

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

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'ping'
      )?.[1] as (event: unknown, message?: string) => Promise<string>;

      const result = await handler({}, 'test');
      expect(result).toBe('pong: test');
    });
  });

  describe('auth:login handler', () => {
    it('should login regular user successfully', async () => {
      registerAuthHandlers();

      vi.mocked(repositories.storeCredentials).mockReturnValue({
        success: true,
        message: 'Stored',
        changes: 1
      });
      vi.mocked(repositories.createSession).mockReturnValue('test-token');

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'auth:login'
      )?.[1] as (event: unknown, email: string, password: string, stayLoggedIn: boolean) => Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }>;

      const result = await handler({}, 'user@example.com', 'password', false);

      expect(result.success).toBe(true);
      expect(result.token).toBe('test-token');
      expect(result.isAdmin).toBe(false);
      expect(repositories.storeCredentials).toHaveBeenCalledWith('smartsheet', 'user@example.com', 'password');
    });

    it('should login admin user successfully', async () => {
      process.env.SHEETPILOT_ADMIN_USERNAME = 'Admin';
      process.env.SHEETPILOT_ADMIN_PASSWORD = 'admin123';

      registerAuthHandlers();

      vi.mocked(repositories.createSession).mockReturnValue('admin-token');

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'auth:login'
      )?.[1] as (event: unknown, email: string, password: string, stayLoggedIn: boolean) => Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }>;

      const result = await handler({}, 'Admin', 'admin123', false);

      expect(result.success).toBe(true);
      expect(result.isAdmin).toBe(true);
      expect(repositories.storeCredentials).not.toHaveBeenCalled();
    });

    it('should handle credential storage failure', async () => {
      registerAuthHandlers();

      vi.mocked(repositories.storeCredentials).mockReturnValue({
        success: false,
        message: 'Storage failed',
        changes: 0
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'auth:login'
      )?.[1] as (event: unknown, email: string, password: string, stayLoggedIn: boolean) => Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }>;

      const result = await handler({}, 'user@example.com', 'password', false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage failed');
    });

    it('should handle errors gracefully', async () => {
      registerAuthHandlers();

      vi.mocked(repositories.storeCredentials).mockImplementation(() => {
        throw new Error('Database error');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'auth:login'
      )?.[1] as (event: unknown, email: string, password: string, stayLoggedIn: boolean) => Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }>;

      const result = await handler({}, 'user@example.com', 'password', false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('auth:validateSession handler', () => {
    it('should validate valid session', async () => {
      registerAuthHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'auth:validateSession'
      )?.[1] as (event: unknown, token: string) => Promise<{ valid: boolean; email?: string; isAdmin?: boolean }>;

      const result = await handler({}, 'test-token');

      expect(result.valid).toBe(true);
      expect(result.email).toBe('user@example.com');
    });

    it('should invalidate invalid session', async () => {
      registerAuthHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: false
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'auth:validateSession'
      )?.[1] as (event: unknown, token: string) => Promise<{ valid: boolean; email?: string; isAdmin?: boolean }>;

      const result = await handler({}, 'invalid-token');

      expect(result.valid).toBe(false);
    });
  });

  describe('auth:logout handler', () => {
    it('should logout user successfully', async () => {
      registerAuthHandlers();

      vi.mocked(repositories.clearSession).mockReturnValue(true);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'auth:logout'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean }>;

      const result = await handler({}, 'test-token');

      expect(result.success).toBe(true);
      expect(repositories.clearSession).toHaveBeenCalledWith('test-token');
    });

    it('should handle logout errors', async () => {
      registerAuthHandlers();

      vi.mocked(repositories.clearSession).mockImplementation(() => {
        throw new Error('Logout failed');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'auth:logout'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Logout failed');
    });
  });

  describe('auth:getCurrentSession handler', () => {
    it('should get current session', async () => {
      registerAuthHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'auth:getCurrentSession'
      )?.[1] as (event: unknown, token: string) => Promise<{ valid: boolean; email?: string; isAdmin?: boolean }>;

      const result = await handler({}, 'test-token');

      expect(result.valid).toBe(true);
      expect(result.email).toBe('user@example.com');
    });
  });
});

