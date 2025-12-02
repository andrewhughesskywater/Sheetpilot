import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeLoggerFallback, developmentLogger } from '../../src/utils/logger-fallback';

describe('logger-fallback', () => {
  let originalWindow: typeof window;
  let mockWindow: Window & typeof globalThis;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalWindow = globalThis.window;
    mockWindow = {
      ...globalThis.window,
      logger: undefined
    } as unknown as Window & typeof globalThis;
    (globalThis as { window: typeof window }).window = mockWindow;

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    // Mock import.meta.env
    vi.stubGlobal('import', {
      meta: {
        env: {
          DEV: true,
          MODE: 'development'
        }
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as { window: typeof window }).window = originalWindow;
  });

  describe('initializeLoggerFallback', () => {
    it('should initialize logger fallback in dev mode when window.logger is missing', () => {
      initializeLoggerFallback();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LoggerFallback] Initializing development logger fallback')
      );
      expect((mockWindow as { logger?: unknown }).logger).toBeDefined();
    });

    it('should not initialize when window.logger already exists', () => {
      const existingLogger = { error: vi.fn() };
      (mockWindow as { logger?: unknown }).logger = existingLogger;

      initializeLoggerFallback();

      expect((mockWindow as { logger?: unknown }).logger).toBe(existingLogger);
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[LoggerFallback] Initializing')
      );
    });

    it('should not initialize in production mode', () => {
      vi.stubGlobal('import', {
        meta: {
          env: {
            DEV: false,
            MODE: 'production'
          }
        }
      });

      initializeLoggerFallback();

      expect((mockWindow as { logger?: unknown }).logger).toBeUndefined();
    });
  });

  describe('developmentLogger', () => {
    it('should log error messages', () => {
      developmentLogger.error('Test error', { errorCode: 123 });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Test error')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('123')
      );
    });

    it('should log warn messages', () => {
      developmentLogger.warn('Test warning', { warningType: 'deprecated' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] Test warning')
      );
    });

    it('should log info messages', () => {
      developmentLogger.info('Test info', { userId: 456 });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Test info')
      );
    });

    it('should log verbose messages', () => {
      developmentLogger.verbose('Test verbose', { debugData: 'test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VERBOSE] Test verbose')
      );
    });

    it('should log debug messages', () => {
      developmentLogger.debug('Test debug', { debugInfo: 'value' });

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] Test debug')
      );
    });

    it('should log user actions', () => {
      developmentLogger.userAction('button-click', { buttonId: 'submit' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[USER-ACTION] User action: button-click')
      );
    });

    it('should format messages with timestamps', () => {
      developmentLogger.error('Test message');

      const call = consoleErrorSpy.mock.calls[0][0] as string;
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include data in formatted messages', () => {
      developmentLogger.info('Test message', { key: 'value' });

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(call).toContain('Data:');
      expect(call).toContain('value');
    });

    it('should handle messages without data', () => {
      developmentLogger.info('Test message');

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(call).not.toContain('Data:');
    });
  });
});


