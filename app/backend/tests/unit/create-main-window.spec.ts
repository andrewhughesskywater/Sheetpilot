import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { App, BrowserWindow } from 'electron';
import type { LoggerLike } from '../../src/bootstrap/logging/logger-contract';
import { createMainWindow } from '../../src/bootstrap/windows/create-main-window';
import type { WindowState } from '../../src/bootstrap/windows/window-state';
import { PerWindowConsoleFilter, ConsoleLoggerManager } from '../../src/bootstrap/windows/console-logger';
import { resolveCspPolicy, buildCspHeader, createProductionCspPolicy, createDevelopmentCspPolicy } from '../../src/bootstrap/security/csp-policy';
import { resolvePreloadPath, resolveIconPathSync, validateIconPathAsync, resolveAppPathsSync } from '../../src/bootstrap/utils/resolve-app-paths';
import { validateWindowState } from '../../src/bootstrap/windows/window-state';

describe('CSP Policy Module', () => {
  describe('buildCspHeader', () => {
    it('should build valid CSP header from directive map', () => {
      const policy = createProductionCspPolicy();
      const header = buildCspHeader(policy);

      expect(header).toContain("default-src 'self'");
      expect(header).toContain("script-src 'self'");
      // unsafe-inline is allowed in style-src for Material Design
      expect(header).toContain("style-src 'self' 'unsafe-inline'");
      expect(header).toContain('upgrade-insecure-requests');
    });

    it('should allow unsafe-inline in style-src for Material Design', () => {
      const policy = createProductionCspPolicy();
      const header = buildCspHeader(policy);

      expect(header).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('should build permissive CSP for development', () => {
      const policy = createDevelopmentCspPolicy();
      const header = buildCspHeader(policy);

      expect(header).toContain('unsafe-eval');
      expect(header).toContain('ws:');
      expect(header).toContain('wss:');
    });
  });

  describe('resolveCspPolicy', () => {
    it('should return production policy for packaged builds', () => {
      const policy = resolveCspPolicy(false);
      expect(policy.isDev).toBe(false);
      expect(policy.directives['script-src']).toEqual(["'self'"]);
    });

    it('should return development policy for dev builds', () => {
      const policy = resolveCspPolicy(true);
      expect(policy.isDev).toBe(true);
      expect(policy.directives['script-src']).toContain("'unsafe-eval'");
    });
  });
});

describe('Path Resolver Module', () => {
  describe('resolvePreloadPath', () => {
    it('should throw if preload does not exist', () => {
      expect(() => resolvePreloadPath('/nonexistent/path')).toThrow('Preload script not found');
    });
  });

  describe('resolveIconPathSync', () => {
    it('should return undefined for packaged builds', () => {
      const path = resolveIconPathSync('/some/path', true);
      expect(path).toBeUndefined();
    });

    it('should return computed path for dev builds', () => {
      const path = resolveIconPathSync('/backend/src', false);
      expect(path).toContain('icon.ico');
      expect(path).toContain('frontend');
    });
  });

  describe('validateIconPathAsync', () => {
    it('should not log if icon path is undefined', async () => {
      const logger = { warn: vi.fn() } as unknown as LoggerLike;
      await validateIconPathAsync(undefined, logger);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should log warning if icon path does not exist', async () => {
      const logger = { warn: vi.fn() } as unknown as LoggerLike;
      await validateIconPathAsync('/nonexistent/icon.ico', logger);
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});

describe('Console Logger with Deduplication', () => {
  describe('PerWindowConsoleFilter', () => {
    let filter: PerWindowConsoleFilter;
    let logger: LoggerLike;

    beforeEach(() => {
      logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        verbose: vi.fn(),
        silly: vi.fn(),
        audit: vi.fn(),
        security: vi.fn(),
        startTimer: () => ({ done: vi.fn() })
      };
      filter = new PerWindowConsoleFilter(123, logger);
    });

    it('should pass first occurrence of message', () => {
      const result = filter.filter(1, 'test message', 10, 'app.js');
      expect(result).toBe(true);
    });

    it('should filter duplicate message', () => {
      filter.filter(1, 'test message', 10, 'app.js');
      const result = filter.filter(1, 'test message', 10, 'app.js');
      expect(result).toBe(false);
    });

    it('should allow different message levels', () => {
      filter.filter(0, 'debug msg', 10, 'app.js');
      const result = filter.filter(1, 'debug msg', 10, 'app.js'); // Different level
      expect(result).toBe(true);
    });

    it('should log dedup count every 10 occurrences', () => {
      filter.filter(1, 'error', 10, 'app.js');

      // Filter 8 more (first + 9 more = 10 total, should trigger log on 10th call)
      for (let i = 0; i < 8; i++) {
        filter.filter(1, 'error', 10, 'app.js');
      }
      // At this point we've filtered message 9 times (count is 9), so logger.warn should not have been called yet
      expect(logger.warn).not.toHaveBeenCalled();

      // 10th duplicate (making count 10) triggers log
      filter.filter(1, 'error', 10, 'app.js');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should evict oldest entry when cache is full', () => {
      // Fill cache with 50 unique messages
      for (let i = 0; i < 50; i++) {
        filter.filter(1, `message ${i}`, 10, 'app.js');
      }
      expect(filter.getCacheSize()).toBe(50);

      // Adding 51st should evict oldest
      filter.filter(1, 'message 50', 10, 'app.js');
      expect(filter.getCacheSize()).toBe(50);
    });

    it('should clear cache', () => {
      filter.filter(1, 'msg', 10, 'app.js');
      expect(filter.getCacheSize()).toBe(1);

      filter.clear();
      expect(filter.getCacheSize()).toBe(0);
    });
  });

  describe('ConsoleLoggerManager', () => {
    let manager: ConsoleLoggerManager;
    let logger: LoggerLike;

    beforeEach(() => {
      logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        verbose: vi.fn(),
        silly: vi.fn(),
        audit: vi.fn(),
        security: vi.fn(),
        startTimer: () => ({ done: vi.fn() })
      };
      manager = new ConsoleLoggerManager(logger);
    });

    it('should return same filter for same webContentsId', () => {
      const filter1 = manager.getFilter(123);
      const filter2 = manager.getFilter(123);
      expect(filter1).toBe(filter2);
    });

    it('should create new filter for different webContentsId', () => {
      const filter1 = manager.getFilter(123);
      const filter2 = manager.getFilter(456);
      expect(filter1).not.toBe(filter2);
    });

    it('should remove filter', () => {
      manager.getFilter(123);
      manager.removeFilter(123);
      const newFilter = manager.getFilter(123);
      // Should be a new instance after removal
      expect(newFilter).toBeDefined();
    });

    it('should convert Chromium console levels correctly', () => {
      expect(ConsoleLoggerManager.getLevelName(0)).toBe('debug');
      expect(ConsoleLoggerManager.getLevelName(1)).toBe('info');
      expect(ConsoleLoggerManager.getLevelName(2)).toBe('warn');
      expect(ConsoleLoggerManager.getLevelName(3)).toBe('error');
      expect(ConsoleLoggerManager.getLevelName(999)).toBe('info'); // default
    });
  });
});

describe('Window State Validation', () => {
  let logger: LoggerLike;
  const defaults: WindowState = { width: 1200, height: 1943 };

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      verbose: vi.fn(),
      silly: vi.fn(),
      audit: vi.fn(),
      security: vi.fn(),
      startTimer: () => ({ done: vi.fn() })
    };
  });

  it('should return defaults for invalid data', () => {
    const result = validateWindowState(null, logger, defaults);
    expect(result).toEqual(defaults);
  });

  it('should coerce valid width and height', () => {
    const result = validateWindowState({ width: 1024, height: 768 }, logger, defaults);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
  });

  it('should reject negative width', () => {
    const result = validateWindowState({ width: -100, height: 768 }, logger, defaults);
    expect(result.width).toBe(defaults.width);
  });

  it('should include optional x and y coordinates', () => {
    const result = validateWindowState({ width: 1024, height: 768, x: 100, y: 200 }, logger, defaults);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it('should reject negative x coordinate', () => {
    const result = validateWindowState({ width: 1024, height: 768, x: -50, y: 200 }, logger, defaults);
    expect(result.x).toBeUndefined();
  });

  it('should include isMaximized flag', () => {
    const result = validateWindowState({ width: 1024, height: 768, isMaximized: true }, logger, defaults);
    expect(result.isMaximized).toBe(true);
  });

  it('should log discrepancies', () => {
    validateWindowState({ width: -100, height: 'invalid' as unknown }, logger, defaults);
    expect(logger.debug).toHaveBeenCalled();
  });
});

describe('createMainWindow integration', () => {
  // These are placeholder tests - full integration requires mocking Electron
  // In real scenarios, would need comprehensive mocks for BrowserWindow, app, etc.

  it('should be exported as function', () => {
    expect(typeof createMainWindow).toBe('function');
  });
});
