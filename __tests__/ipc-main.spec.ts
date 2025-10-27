import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// Mock electron-updater to prevent import failures
vi.mock('electron-updater', () => {
  const autoUpdater = {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    logger: null,
    on: vi.fn(),
    checkForUpdates: vi.fn(() => Promise.resolve()),
    downloadUpdate: vi.fn(() => Promise.resolve())
  };
  return { autoUpdater };
});

// Mocks for Electron primitives used by main.ts
vi.mock('electron', () => {
  // Initialize handlers storage in the mock factory (hoisted)
  if (!globalThis.__test_handlers) {
    globalThis.__test_handlers = {};
  }
  
  // Minimal BrowserWindow stub
  class BrowserWindow {
    public webContents: any;
    constructor(_opts: any) {
      this.webContents = {
        on: vi.fn(),
        once: vi.fn(),
        send: vi.fn()
      };
    }
    loadURL = vi.fn();
    loadFile = vi.fn();
    once = vi.fn();
    on = vi.fn();
    show = vi.fn();
    maximize = vi.fn();
    getBounds = vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 }));
    isMaximized = vi.fn(() => false);
  }

  const ipcMain = {
    handle: vi.fn((channel: string, fn: any) => {
      // Store handlers in global scope
      globalThis.__test_handlers[channel] = fn;
      return undefined;
    }),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn()
  };

  const dialog = {
    showOpenDialog: vi.fn()
  };

  const shell = {
    openPath: vi.fn()
  };

  const app = {
    isPackaged: false,
    getPath: vi.fn((key: string) => (key === 'userData' ? 'C:/tmp/sheetpilot-userdata' : 'C:/tmp')),
    // Make whenReady return a thenable that immediately executes the callback
    whenReady: vi.fn(() => ({
      then: (callback: () => void) => {
        // Execute the callback immediately (synchronously) for testing
        callback();
        return Promise.resolve();
      },
      catch: () => Promise.resolve()
    })),
    on: vi.fn(),
    quit: vi.fn()
  };

  const screen = {
    getPrimaryDisplay: vi.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 }
    }))
  };

  return { app, BrowserWindow, ipcMain, dialog, shell, screen };
});

// Mock backend modules used by main.ts
vi.mock('../src/services/database', () => {
  return {
    setDbPath: vi.fn(),
    ensureSchema: vi.fn(),
    getDbPath: vi.fn(() => 'C:/tmp/sheetpilot.sqlite'),
    storeCredentials: vi.fn(),
    getCredentials: vi.fn(() => null),
    listCredentials: vi.fn(() => []),
    deleteCredentials: vi.fn(),
    openDb: vi.fn(() => ({
      prepare: vi.fn(() => ({ all: vi.fn(() => []), get: vi.fn(() => ({})) })),
      exec: vi.fn(),
      close: vi.fn()
    }))
  };
});

vi.mock('../src/services/timesheet_importer', () => {
  return {
    submitTimesheets: vi.fn(async () => ({ ok: true, submittedIds: [1], removedIds: [], totalProcessed: 1, successCount: 1, removedCount: 0 }))
  };
});

// Mock the logger module to prevent electron initialization issues
vi.mock('../src/shared/logger', () => {
  const createMockLogger = () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    audit: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() }))
  });
  
  return {
    initializeLogging: vi.fn(),
    configureLogger: vi.fn(),
    appLogger: createMockLogger(),
    dbLogger: createMockLogger(),
    ipcLogger: createMockLogger(),
    importLogger: createMockLogger(),
    botLogger: createMockLogger()
  };
});

// Import main.ts AFTER mocks so its side-effects (handler registration) use our stubs
import { registerIPCHandlers } from '../src/main/main';

// Re-get typed references to mocked modules for assertions
import * as db from '../src/services/database';
import * as imp from '../src/services/timesheet_importer';

// Create local reference to handlers after all imports
const handlers = globalThis.__test_handlers;

describe('Electron IPC Handlers (main.ts)', () => {
  beforeEach(() => {
    // Reset stub return values between tests
    (imp as any).submitTimesheets.mockClear?.();
    (db as any).getCredentials.mockReset?.();
  });

  beforeAll(() => {
    // Manually call registerIPCHandlers to set up handlers for testing
    registerIPCHandlers();
  });

  it('timesheet:submit returns error if credentials missing', async () => {
    (db as any).getCredentials.mockReturnValue(null);
    const res = await handlers['timesheet:submit']();
    expect(res.error).toMatch(/credentials not found/i);
  });

  it('timesheet:submit submits with stored credentials', async () => {
    (db as any).getCredentials.mockReturnValue({ email: 'user@test', password: 'pw' });
    const res = await handlers['timesheet:submit']();
    expect((imp as any).submitTimesheets).toHaveBeenCalledWith('user@test', 'pw');
    expect(res.submitResult?.ok).toBe(true);
  });
});


