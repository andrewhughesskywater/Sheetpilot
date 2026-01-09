import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerLoggerHandlers } from '@/ipc/logger-handlers';
import { ipcLogger } from '@sheetpilot/shared/logger';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn(),
  },
}));

vi.mock('@/ipc/handlers/timesheet/main-window', () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

// Mock logger
vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    verbose: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('logger-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerLoggerHandlers', () => {
    it('should register all logger IPC handlers', () => {
      registerLoggerHandlers();

      expect(ipcMain.on).toHaveBeenCalledTimes(6);
      expect(ipcMain.on).toHaveBeenCalledWith('logger:error', expect.any(Function));
      expect(ipcMain.on).toHaveBeenCalledWith('logger:warn', expect.any(Function));
      expect(ipcMain.on).toHaveBeenCalledWith('logger:info', expect.any(Function));
      expect(ipcMain.on).toHaveBeenCalledWith('logger:verbose', expect.any(Function));
      expect(ipcMain.on).toHaveBeenCalledWith('logger:debug', expect.any(Function));
      expect(ipcMain.on).toHaveBeenCalledWith('logger:user-action', expect.any(Function));
    });

    it('should route logger:error to ipcLogger.error', () => {
      registerLoggerHandlers();

      const errorHandler = vi.mocked(ipcMain.on).mock.calls.find((call) => call[0] === 'logger:error')?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      expect(errorHandler).toBeDefined();

      const mockEvent = {};
      errorHandler(mockEvent, 'Test error', { errorCode: 123 });

      expect(ipcLogger.error).toHaveBeenCalledWith('Test error', { errorCode: 123 });
    });

    it('should route logger:warn to ipcLogger.warn', () => {
      registerLoggerHandlers();

      const warnHandler = vi.mocked(ipcMain.on).mock.calls.find((call) => call[0] === 'logger:warn')?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      expect(warnHandler).toBeDefined();

      const mockEvent = {};
      warnHandler(mockEvent, 'Test warning', { warningType: 'deprecated' });

      expect(ipcLogger.warn).toHaveBeenCalledWith('Test warning', { warningType: 'deprecated' });
    });

    it('should route logger:info to ipcLogger.info', () => {
      registerLoggerHandlers();

      const infoHandler = vi.mocked(ipcMain.on).mock.calls.find((call) => call[0] === 'logger:info')?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      expect(infoHandler).toBeDefined();

      const mockEvent = {};
      infoHandler(mockEvent, 'Test info', { userId: 456 });

      expect(ipcLogger.info).toHaveBeenCalledWith('Test info', { userId: 456 });
    });

    it('should route logger:verbose to ipcLogger.verbose', () => {
      registerLoggerHandlers();

      const verboseHandler = vi.mocked(ipcMain.on).mock.calls.find((call) => call[0] === 'logger:verbose')?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      expect(verboseHandler).toBeDefined();

      const mockEvent = {};
      verboseHandler(mockEvent, 'Test verbose', { debugData: 'test' });

      expect(ipcLogger.verbose).toHaveBeenCalledWith('Test verbose', { debugData: 'test' });
    });

    it('should route logger:debug to ipcLogger.debug', () => {
      registerLoggerHandlers();

      const debugHandler = vi.mocked(ipcMain.on).mock.calls.find((call) => call[0] === 'logger:debug')?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      expect(debugHandler).toBeDefined();

      const mockEvent = {};
      debugHandler(mockEvent, 'Test debug', { debugInfo: 'value' });

      expect(ipcLogger.debug).toHaveBeenCalledWith('Test debug', { debugInfo: 'value' });
    });

    it('should route logger:user-action to ipcLogger.info with formatted message', () => {
      registerLoggerHandlers();

      const userActionHandler = vi
        .mocked(ipcMain.on)
        .mock.calls.find((call) => call[0] === 'logger:user-action')?.[1] as (
        event: unknown,
        action: string,
        data?: unknown
      ) => void;

      expect(userActionHandler).toBeDefined();

      const mockEvent = {};
      userActionHandler(mockEvent, 'button-click', { buttonId: 'submit' });

      expect(ipcLogger.info).toHaveBeenCalledWith('User action: button-click', { buttonId: 'submit' });
    });

    it('should handle handlers without data parameter', () => {
      registerLoggerHandlers();

      const errorHandler = vi.mocked(ipcMain.on).mock.calls.find((call) => call[0] === 'logger:error')?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      const mockEvent = {};
      errorHandler(mockEvent, 'Error without data');

      expect(ipcLogger.error).toHaveBeenCalledWith('Error without data', undefined);
    });
  });
});
