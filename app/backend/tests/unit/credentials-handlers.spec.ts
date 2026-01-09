import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerCredentialsHandlers } from '@/ipc/credentials-handlers';
import * as repositories from '@/repositories';
import {
  CredentialsNotFoundError as _CredentialsNotFoundError,
  CredentialsStorageError,
} from '@sheetpilot/shared/errors';

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
  listCredentials: vi.fn(),
  deleteCredentials: vi.fn(),
}));

// Mock logger
vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    audit: vi.fn(),
    info: vi.fn(),
    security: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock validation
vi.mock('@/validation/validate-ipc-input', () => ({
  validateInput: vi.fn((schema, data) => ({ success: true, data })),
}));

describe('credentials-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerCredentialsHandlers', () => {
    it('should register all credentials handlers', () => {
      registerCredentialsHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('credentials:store', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('credentials:list', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('credentials:delete', expect.any(Function));
    });
  });

  describe('credentials:store handler', () => {
    it('should store credentials successfully', async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.storeCredentials).mockReturnValue({
        success: true,
        message: 'Stored',
        changes: 1,
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'credentials:store')?.[1] as (
        event: unknown,
        service: string,
        email: string,
        password: string
      ) => Promise<{ success: boolean; message?: string; changes?: number; error?: string }>;

      const result = await handler({}, 'smartsheet', 'user@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(repositories.storeCredentials).toHaveBeenCalledWith('smartsheet', 'user@example.com', 'password123');
    });

    it('should handle storage errors', async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.storeCredentials).mockImplementation(() => {
        throw new Error('Storage failed');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'credentials:store')?.[1] as (
        event: unknown,
        service: string,
        email: string,
        password: string
      ) => Promise<unknown>;

      await expect(handler({}, 'smartsheet', 'user@example.com', 'password123')).rejects.toThrow(
        CredentialsStorageError
      );
    });
  });

  describe('credentials:list handler', () => {
    it('should list credentials successfully', async () => {
      registerCredentialsHandlers();

      const mockCredentials = [
        { id: 1, service: 'smartsheet', email: 'user@example.com', created_at: '2025-01-01', updated_at: '2025-01-01' },
      ];

      vi.mocked(repositories.listCredentials).mockReturnValue(mockCredentials as never);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'credentials:list')?.[1] as (
        event: unknown
      ) => Promise<{ success: boolean; credentials: unknown[] }>;

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual(mockCredentials);
    });

    it('should handle list errors', async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.listCredentials).mockImplementation(() => {
        throw new Error('List failed');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'credentials:list')?.[1] as (
        event: unknown
      ) => Promise<{ success: boolean; credentials: unknown[]; error?: string }>;

      const result = await handler({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('List failed');
      expect(result.credentials).toEqual([]);
    });
  });

  describe('credentials:delete handler', () => {
    it('should delete credentials successfully', async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.deleteCredentials).mockReturnValue({
        success: true,
        message: 'Deleted',
        changes: 1,
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'credentials:delete')?.[1] as (
        event: unknown,
        service: string
      ) => Promise<{ success: boolean; changes?: number; error?: string }>;

      const result = await handler({}, 'smartsheet');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(repositories.deleteCredentials).toHaveBeenCalledWith('smartsheet');
    });

    it('should handle delete errors', async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.deleteCredentials).mockImplementation(() => {
        throw new Error('Delete failed');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'credentials:delete')?.[1] as (
        event: unknown,
        service: string
      ) => Promise<{ success: boolean; changes?: number; error?: string }>;

      const result = await handler({}, 'smartsheet');

      expect(result.success).toBe(false);
      // Implementation returns `message` for this handler on error.
      expect((result as { message?: string }).message).toBe('Delete failed');
      expect(result.changes).toBe(0);
    });
  });
});
