import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerDatabaseHandlers } from '@/ipc/database-handlers';
import * as repositories from '@/repositories'';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}));

vi.mock('@/ipc/handlers/timesheet/main-window', () => ({
  isTrustedIpcSender: vi.fn(() => true)
}));

// Mock repositories
vi.mock('@/repositories', () => ({
  getDb: vi.fn(),
  validateSession: vi.fn()
}));

// Mock logger
vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    security: vi.fn(),
    verbose: vi.fn(),
    audit: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('database-handlers', () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      prepare: vi.fn(),
      exec: vi.fn()
    };
    vi.mocked(repositories.getDb).mockReturnValue(mockDb as never);
  });

  describe('registerDatabaseHandlers', () => {
    it('should register all database handlers', () => {
      registerDatabaseHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('database:getAllTimesheetEntries', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('database:getAllArchiveData', expect.any(Function));
    });
  });

  describe('database:getAllTimesheetEntries handler', () => {
    it('should get timesheet entries with pagination', async () => {
      registerDatabaseHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false
      });

      const mockCountStmt = {
        get: vi.fn().mockReturnValue({ total: 150 })
      };

      const mockGetAllStmt = {
        all: vi.fn().mockReturnValue([
          { id: 1, date: '2025-01-15', status: 'Complete' },
          { id: 2, date: '2025-01-16', status: 'Complete' }
        ])
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) return mockCountStmt;
        return mockGetAllStmt;
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'database:getAllTimesheetEntries'
      )?.[1] as (event: unknown, token: string, options?: { page?: number; pageSize?: number }) => Promise<{ success: boolean; entries: unknown[]; totalCount: number; page: number; pageSize: number; totalPages: number }>;

      const result = await handler({}, 'test-token', { page: 0, pageSize: 100 });

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(2);
      expect(result.totalCount).toBe(150);
      expect(result.totalPages).toBe(2);
    });

    it('should reject requests without token', async () => {
      registerDatabaseHandlers();

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'database:getAllTimesheetEntries'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session token is required');
    });

    it('should reject invalid sessions', async () => {
      registerDatabaseHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: false
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'database:getAllTimesheetEntries'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session is invalid');
    });

    it('should handle database errors', async () => {
      registerDatabaseHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false
      });

      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'database:getAllTimesheetEntries'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('database:getAllArchiveData handler', () => {
    it('should get all archive data', async () => {
      registerDatabaseHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: 'user@example.com',
        isAdmin: false
      });

      const mockTimesheet = [{ id: 1, date: '2025-01-15', status: 'Complete' }];
      const mockCredentials = [{ id: 1, service: 'smartsheet', email: 'user@example.com' }];

      const mockStmt = {
        all: vi.fn()
          .mockReturnValueOnce(mockTimesheet)
          .mockReturnValueOnce(mockCredentials)
      };

      mockDb.prepare.mockReturnValue(mockStmt);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'database:getAllArchiveData'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; timesheet?: unknown[]; credentials?: unknown[] }>;

      const result = await handler({}, 'test-token');

      expect(result.success).toBe(true);
      expect(result.timesheet).toEqual(mockTimesheet);
      expect(result.credentials).toEqual(mockCredentials);
    });

    it('should reject requests without token', async () => {
      registerDatabaseHandlers();

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === 'database:getAllArchiveData'
      )?.[1] as (event: unknown, token: string) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session token is required');
    });
  });
});

