import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerAdminHandlers } from '../../src/ipc/admin-handlers';
import * as repositories from '../../src/repositories';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}));

// Mock repositories
vi.mock('../../src/repositories', () => ({
  validateSession: vi.fn(),
  clearAllCredentials: vi.fn(),
  rebuildDatabase: vi.fn()
}));

// Mock logger
vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    security: vi.fn(),
    audit: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}));

// Mock validation
vi.mock('../../src/validation/validate-ipc-input', () => ({
  validateInput: vi.fn((schema, data) => ({ success: true, data }))
}));

// Mock isTrustedIpcSender to return true for tests
vi.mock('../../src/ipc/handlers/timesheet/main-window', () => ({
  isTrustedIpcSender: vi.fn(() => true)
}));

describe('admin-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerAdminHandlers', () => {
    it('should register all admin handlers', () => {
      registerAdminHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('admin:clearCredentials', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('admin:rebuildDatabase', expect.any(Function));
    });
  });

  describe('admin:clearCredentials handler', () => {
    it('should clear credentials when admin authenticated', async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'admin@example.com',
        isAdmin: true
      });

      vi.mocked(repositories.clearAllCredentials).mockReturnValue(undefined);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'admin:clearCredentials'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'admin-token');

      expect(result.success).toBe(true);
      expect(repositories.clearAllCredentials).toHaveBeenCalled();
    });

    it('should reject non-admin users', async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'admin:clearCredentials'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'user-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
      expect(repositories.clearAllCredentials).not.toHaveBeenCalled();
    });

    it('should reject invalid sessions', async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: false
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'admin:clearCredentials'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    it('should handle errors gracefully', async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'admin@example.com',
        isAdmin: true
      });

      vi.mocked(repositories.clearAllCredentials).mockImplementation(() => {
        throw new Error('Clear failed');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'admin:clearCredentials'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'admin-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clear failed');
    });
  });

  describe('admin:rebuildDatabase handler', () => {
    it('should rebuild database when admin authenticated', async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'admin@example.com',
        isAdmin: true
      });

      vi.mocked(repositories.rebuildDatabase).mockReturnValue(undefined);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'admin:rebuildDatabase'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'admin-token');

      expect(result.success).toBe(true);
      expect(repositories.rebuildDatabase).toHaveBeenCalled();
    });

    it('should reject non-admin users', async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'admin:rebuildDatabase'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'user-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
      expect(repositories.rebuildDatabase).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'admin@example.com',
        isAdmin: true
      });

      vi.mocked(repositories.rebuildDatabase).mockImplementation(() => {
        throw new Error('Rebuild failed');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'admin:rebuildDatabase'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'admin-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rebuild failed');
    });
  });
});

