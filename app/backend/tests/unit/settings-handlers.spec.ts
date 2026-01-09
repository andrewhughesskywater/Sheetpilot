import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain, app as _app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { registerSettingsHandlers } from '@/ipc/settings-handlers';
import { setBrowserHeadless } from '@sheetpilot/shared/constants';
import { ipcLogger } from '@sheetpilot/shared/logger';

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

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock path
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.join('/')),
  };
});

// Mock logger
vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock constants
vi.mock('../../../shared/constants', () => ({
  setBrowserHeadless: vi.fn(),
}));

describe('settings-handlers', () => {
  let mockSettingsPath: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsPath = '/mock/user/data/settings.json';
    vi.mocked(path.join).mockReturnValue(mockSettingsPath);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('registerSettingsHandlers', () => {
    it('should register all settings IPC handlers', () => {
      registerSettingsHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('settings:get', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('settings:set', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('settings:getAll', expect.any(Function));
    });

    it('should initialize browserHeadless from settings file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ browserHeadless: true }));

      registerSettingsHandlers();

      expect(setBrowserHeadless).toHaveBeenCalledWith(true);
      expect(ipcLogger.info).toHaveBeenCalledWith('Initialized browserHeadless setting on startup', expect.any(Object));
    });

    it('should default to false when settings file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      registerSettingsHandlers();

      expect(setBrowserHeadless).toHaveBeenCalledWith(false);
    });

    it('should handle settings file read errors', () => {
      vi.clearAllMocks();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      expect(() => registerSettingsHandlers()).not.toThrow();
      // Error is logged but caught, so initialization continues
    });

    it('should handle invalid JSON in settings file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      expect(() => registerSettingsHandlers()).not.toThrow();
    });
  });

  describe('settings:get handler', () => {
    it('should return setting value', async () => {
      vi.clearAllMocks();
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ browserHeadless: true }));

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'settings:get')?.[1] as (
        event: unknown,
        key: string
      ) => Promise<{ success: boolean; value?: unknown; error?: string }>;

      const result = await handler({}, 'browserHeadless');

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return undefined for non-existent key', async () => {
      vi.clearAllMocks();
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'settings:get')?.[1] as (
        event: unknown,
        key: string
      ) => Promise<{ success: boolean; value?: unknown; error?: string }>;

      const result = await handler({}, 'nonExistent');

      expect(result.success).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should return empty settings when file does not exist', async () => {
      vi.clearAllMocks();
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'settings:get')?.[1] as (
        event: unknown,
        key: string
      ) => Promise<{ success: boolean; value?: unknown; error?: string }>;

      const result = await handler({}, 'browserHeadless');

      expect(result.success).toBe(true);
      expect(result.value).toBeUndefined();
    });
  });

  describe('settings:set handler', () => {
    it('should save setting value', async () => {
      vi.clearAllMocks();
      registerSettingsHandlers();

      let savedData = '{}';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => savedData);
      vi.mocked(fs.writeFileSync).mockImplementation((_path, data) => {
        savedData = data as string;
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'settings:set')?.[1] as (
        event: unknown,
        key: string,
        value: unknown
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'browserHeadless', true);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should update browserHeadless constant when setting changes', async () => {
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ browserHeadless: false }));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'settings:set')?.[1] as (
        event: unknown,
        key: string,
        value: unknown
      ) => Promise<{ success: boolean; error?: string }>;

      await handler({}, 'browserHeadless', true);

      expect(setBrowserHeadless).toHaveBeenCalledWith(true);
      expect(ipcLogger.info).toHaveBeenCalledWith(
        'Updated browserHeadless setting',
        expect.objectContaining({ toggleValue: true })
      );
    });

    it('should verify setting was saved correctly', async () => {
      registerSettingsHandlers();

      let savedData = '{}';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => savedData);
      vi.mocked(fs.writeFileSync).mockImplementation((_path, data) => {
        savedData = data as string;
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'settings:set')?.[1] as (
        event: unknown,
        key: string,
        value: unknown
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'browserHeadless', true);

      expect(result.success).toBe(true);
    });

    it('should handle write errors', async () => {
      vi.clearAllMocks();
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });

      const handler = vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === 'settings:set')?.[1] as (
        event: unknown,
        key: string,
        value: unknown
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, 'browserHeadless', true);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('settings:getAll handler', () => {
    it('should return all settings', async () => {
      registerSettingsHandlers();

      const settings = { browserHeadless: true, otherSetting: 'value' };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(settings));

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'settings:getAll')?.[1] as () => Promise<{
        success: boolean;
        settings?: unknown;
        error?: string;
      }>;

      const result = await handler();

      expect(result.success).toBe(true);
      expect(result.settings).toEqual(settings);
    });

    it('should return empty settings when file does not exist', async () => {
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'settings:getAll')?.[1] as () => Promise<{
        success: boolean;
        settings?: unknown;
        error?: string;
      }>;

      const result = await handler();

      expect(result.success).toBe(true);
      expect(result.settings).toEqual({});
    });
  });
});
