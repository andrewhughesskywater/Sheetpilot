import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain, app as _app } from 'electron';
import * as fs from 'fs';
import * as _path from 'path';
import { registerLogsHandlers } from '@/ipc/logs-handlers';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

vi.mock('@/ipc/handlers/timesheet/main-window', () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

vi.mock('@/repositories', () => ({
  validateSession: vi.fn(() => ({ valid: true, email: 'user@example.com', isAdmin: false })),
}));

vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    security: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    promises: {
      readdir: vi.fn(),
      readFile: vi.fn(),
    },
  },
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

// Mock path
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.join('/')),
  };
});

// Mock validation
vi.mock('@/validation/validate-ipc-input', () => ({
  validateInput: vi.fn((schema, data) => ({ success: true, data })),
}));

describe('logs-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerLogsHandlers', () => {
    it('should register all logs handlers', () => {
      registerLogsHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('logs:getLogPath', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('logs:exportLogs', expect.any(Function));
    });
  });

  describe('logs:getLogPath handler', () => {
    it('should get latest log file path', async () => {
      registerLogsHandlers();

      vi.mocked(fs.promises.readdir).mockResolvedValue([
        'sheetpilot_2025-01-01.log',
        'sheetpilot_2025-01-02.log',
        'other-file.txt',
      ] as never);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'logs:getLogPath')?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; logPath?: string; logFiles?: string[] }>;

      const result = await handler({}, 'test-token');

      expect(result.success).toBe(true);
      expect(result.logPath).toBe('/mock/user/data/sheetpilot_2025-01-02.log');
      expect(result.logFiles).toBeDefined();
      expect(result.logFiles!.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle no log files found', async () => {
      registerLogsHandlers();

      vi.mocked(fs.promises.readdir).mockResolvedValue(['other-file.txt'] as never);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'logs:getLogPath')?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No log files found');
    });

    it('should handle readdir errors', async () => {
      registerLogsHandlers();

      vi.mocked(fs.promises.readdir).mockRejectedValue(new Error('Read error'));

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'logs:getLogPath')?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read error');
    });
  });

  describe('logs:exportLogs handler', () => {
    it('should export logs as JSON', async () => {
      registerLogsHandlers();

      const mockLogContent = '{"level":"info","message":"Test"}';

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockLogContent);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'logs:exportLogs')?.[1] as (
        event: unknown,
        token: string,
        logPath: string,
        exportFormat: 'json' | 'txt'
      ) => Promise<{ success: boolean; content?: string; filename?: string; mimeType?: string }>;

      const result = await handler({}, 'test-token', '/mock/user/data/sheetpilot_2025-01-02.log', 'json');

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('application/json');
      expect(result.filename).toMatch(/\.json$/);
      expect(JSON.parse(result.content!)).toBeInstanceOf(Array);
    });

    it('should export logs as text', async () => {
      registerLogsHandlers();

      const mockLogContent = 'Log line 1\nLog line 2';

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockLogContent);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'logs:exportLogs')?.[1] as (
        event: unknown,
        token: string,
        logPath: string,
        exportFormat: 'json' | 'txt'
      ) => Promise<{ success: boolean; content?: string; filename?: string; mimeType?: string }>;

      const result = await handler({}, 'test-token', '/mock/user/data/sheetpilot_2025-01-02.log', 'txt');

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('text/plain');
      expect(result.filename).toMatch(/\.txt$/);
      expect(result.content).toBe(mockLogContent);
    });

    it('should default to text export', async () => {
      registerLogsHandlers();

      const mockLogContent = 'Log content';

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockLogContent);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'logs:exportLogs')?.[1] as (
        event: unknown,
        token: string,
        logPath: string,
        exportFormat?: 'json' | 'txt'
      ) => Promise<{ success: boolean; mimeType?: string }>;

      const result = await handler({}, 'test-token', '/mock/user/data/sheetpilot_2025-01-02.log');

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('text/plain');
    });

    it('should handle read errors', async () => {
      registerLogsHandlers();

      vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('Read error'));

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'logs:exportLogs')?.[1] as (
        event: unknown,
        token: string,
        logPath: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'test-token', '/mock/user/data/sheetpilot_2025-01-02.log');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read error');
    });
  });
});
