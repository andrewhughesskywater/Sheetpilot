import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerCredentialsHandlers } from '../../src/ipc/credentials-handlers';
import * as repositories from '../../src/repositories';
import { CredentialsNotFoundError as _CredentialsNotFoundError, CredentialsStorageError } from '../../../shared/errors';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}));

// Mock repositories
vi.mock('../../src/repositories', () => ({
  storeCredentials: vi.fn(),
  getCredentials: vi.fn(),
  listCredentials: vi.fn(),
  deleteCredentials: vi.fn()
}));

// Mock logger
vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    audit: vi.fn(),
    info: vi.fn(),
    security: vi.fn(),
    error: vi.fn()
  }
}));

// Mock validation
vi.mock('../../src/validation/validate-ipc-input', () => ({
  validateInput: vi.fn((schema, data) => ({ success: true, data }))
}));

describe('credentials-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerCredentialsHandlers', () => {
    it('should register all credentials handlers', () => {
      registerCredentialsHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('credentials:store', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('credentials:get', expect.any(Function));
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
        changes: 1
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'credentials:store'
      )?.[1] as (event: unknown, service: string, email: string, password: string) => Promise<{ success: boolean; message?: string; changes?: number; error?: string }>;

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

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'credentials:store'
      )?.[1] as (event: unknown, service: string, email: string, password: string) => Promise<unknown>;

      await expect(handler({}, 'smartsheet', 'user@example.com', 'password123')).rejects.toThrow(CredentialsStorageError);
    });
  });

  describe('credentials:get handler', () => {
    it('should get credentials successfully', async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.getCredentials).mockReturnValue({
        email: 'user@example.com',
        password: 'password123'
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'credentials:get'
      )?.[1] as (event: unknown, service: string) => Promise<{ success: boolean; credentials?: unknown; error?: string }>;

      const result = await handler({}, 'smartsheet');

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual({
        email: 'user@example.com',
        password: 'password123'
      });
    });

    it('should handle credentials not found', async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.getCredentials).mockReturnValue(null);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'credentials:get'
      )?.[1] as (event: unknown, service: string) => Promise<{ success: boolean; credentials?: unknown; error?: string }>;

      const result = await handler({}, 'smartsheet');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.getCredentials).mockImplementation(() => {
        throw new Error('Database error');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'credentials:get'
      )?.[1] as (event: unknown, service: string) => Promise<{ success: boolean; credentials?: unknown; error?: string }>;

      const result = await handler({}, 'smartsheet');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('credentials:list handler', () => {
    it('should list credentials successfully', async () => {
      registerCredentialsHandlers();

      const mockCredentials = [
        { id: 1, service: 'smartsheet', email: 'user@example.com', created_at: '2025-01-01', updated_at: '2025-01-01' }
      ];

      vi.mocked(repositories.listCredentials).mockReturnValue(mockCredentials as never);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'credentials:list'
      )?.[1] as () => Promise<{ success: boolean; credentials: unknown[] }>;

      const result = await handler();

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual(mockCredentials);
    });

    it('should handle list errors', async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.listCredentials).mockImplementation(() => {
        throw new Error('List failed');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'credentials:list'
      )?.[1] as () => Promise<{ success: boolean; credentials: unknown[]; error?: string }>;

      const result = await handler();

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
        changes: 1
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'credentials:delete'
      )?.[1] as (event: unknown, service: string) => Promise<{ success: boolean; changes?: number; error?: string }>;

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

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'credentials:delete'
      )?.[1] as (event: unknown, service: string) => Promise<{ success: boolean; changes?: number; error?: string }>;

      const result = await handler({}, 'smartsheet');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
      expect(result.changes).toBe(0);
    });
  });
});

