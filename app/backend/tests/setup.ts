/**
 * Vitest setup file
 * This file runs before all tests to configure the test environment
 */

import { vi, afterEach } from 'vitest';

// Track created database paths for fs.existsSync mocking
// This needs to be accessible from both mocks
const createdDbPaths = new Set<string>();

// Mock fs.existsSync FIRST before better-sqlite3, so it's available when database is created
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (path: string | Buffer) => {
      const pathStr = path.toString();
      // Check if this is a database path we've tracked
      if (createdDbPaths.has(pathStr)) {
        return true;
      }
      // Check if any tracked path is a parent/child (simple substring check)
      for (const createdPath of createdDbPaths) {
        if (pathStr.includes(createdPath) || createdPath.includes(pathStr)) {
          return true;
        }
      }
      // Fall back to actual fs.existsSync for non-database paths
      return actual.existsSync(path);
    },
  };
});

// Mock better-sqlite3 to avoid NODE_MODULE_VERSION mismatch
// MUST be synchronous for proper hoisting
vi.mock('better-sqlite3', async () => {
  const pathModule = await import('path');

  // Import the comprehensive in-memory database mock
  const { createInMemoryDatabase } = await import('./fixtures/in-memory-db-mock');

  // Use the createInMemoryDatabase function which manages its own instance cache
  // This ensures we don't have two separate caches that can get out of sync
  function Database(path: string, _opts?: unknown) {
    const resolvedPath = pathModule.resolve(path);
    createdDbPaths.add(resolvedPath);
    createdDbPaths.add(pathModule.dirname(resolvedPath));

    // Always use createInMemoryDatabase - it handles caching internally
    return createInMemoryDatabase(resolvedPath);
  }

  return {
    default: Database,
    Database: Database,
    __esModule: true,
  };
});

// Mock Electron browser automation to prevent actual browser windows in tests
// Creates consistent mock objects that support proper lifecycle management

// Helper to create a mock locator
function createMockLocator() {
  const mockLocator = {
    fill: vi.fn(() => Promise.resolve()),
    click: vi.fn(() => Promise.resolve()),
    type: vi.fn(() => Promise.resolve()),
    press: vi.fn(() => Promise.resolve()),
    waitFor: vi.fn(() => Promise.resolve()),
    isVisible: vi.fn(() => Promise.resolve(true)),
    isEnabled: vi.fn(() => Promise.resolve(true)),
    count: vi.fn(() => Promise.resolve(1)),
    getAttribute: vi.fn(() => Promise.resolve(null)),
    textContent: vi.fn(() => Promise.resolve(null)),
    evaluate: vi.fn(() => Promise.resolve({})),
    boundingBox: vi.fn(() => Promise.resolve(null)),
    first: vi.fn(function (this: typeof mockLocator) {
      return this;
    }),
    nth: vi.fn(function (this: typeof mockLocator) {
      return this;
    }),
    locator: vi.fn(function (this: typeof mockLocator) {
      return this;
    }),
  };
  return mockLocator;
}

// Helper to create a mock page
function createMockPage() {
  let currentUrl = 'http://localhost';
  const mockPage = {
    goto: vi.fn((url) => {
      currentUrl = url;
      return Promise.resolve();
    }),
    url: vi.fn(() => currentUrl),
    route: vi.fn(() => Promise.resolve()), // Add route for interception
    locator: vi.fn(() => createMockLocator()),
    executeJavaScript: vi.fn(() => Promise.resolve({})),
    waitForLoadState: vi.fn(() => Promise.resolve()),
    waitForSelector: vi.fn(() => Promise.resolve()),
    waitForTimeout: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    off: vi.fn(),
    getWebContents: vi.fn(() => ({
      loadURL: vi.fn(),
      getURL: vi.fn(() => 'http://localhost'),
      executeJavaScript: vi.fn(() => Promise.resolve({})),
      session: {
        webRequest: {
          onCompleted: vi.fn(),
          onBeforeSendHeaders: vi.fn(),
        },
      },
    })),
  };
  return mockPage;
}

// Helper to create a mock context that shares the same page
function createMockContext(page: ReturnType<typeof createMockPage>) {
  return {
    newPage: vi.fn(() => Promise.resolve(page)),
    close: vi.fn(() => Promise.resolve()),
    addInitScript: vi.fn(() => Promise.resolve()),
    getBrowserWindow: vi.fn(() => ({
      webContents: page.getWebContents(),
      close: vi.fn(),
      isDestroyed: vi.fn(() => false),
    })),
  };
}

// Helper to create a mock browser with consistent page/context
function createMockBrowser() {
  const mockPage = createMockPage();
  const mockContext = createMockContext(mockPage);

  return {
    newContext: vi.fn(() => Promise.resolve(mockContext)),
    close: vi.fn(() => Promise.resolve()),
    getContexts: vi.fn(() => [mockContext]),
  };
}

vi.mock('@/services/bot/src/electron-browser', () => ({
  ElectronBrowser: {
    launch: vi.fn(() => Promise.resolve(createMockBrowser())),
  },
  chromium: vi.fn(() => ({
    launch: vi.fn(() => Promise.resolve(createMockBrowser())),
  })),
  ElectronBrowserContext: vi.fn(),
  ElectronPage: vi.fn(),
  ElectronLocator: vi.fn(),
}));

// Mock Electron to provide app.isPackaged and other required APIs
vi.mock('electron', () => ({
  app: {
    isPackaged: false, // Always false in tests (development mode)
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/tmp/test-userdata';
      if (name === 'appData') return '/tmp/test-appdata';
      return '/tmp/test-path';
    }),
    on: vi.fn(),
    once: vi.fn(),
    quit: vi.fn(),
    exit: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  dialog: {
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
    showOpenDialog: vi.fn(() => Promise.resolve({ filePaths: [] })),
    showSaveDialog: vi.fn(() => Promise.resolve({ filePath: '' })),
  },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 },
    })),
  },
}));

// Clean up after each test to prevent memory leaks and test interference
afterEach(async () => {
  // Clear created database paths and instances between tests for isolation
  createdDbPaths.clear();
  // Reset database instances to ensure isolation between tests
  try {
    const { resetDatabaseInstances } = await import('./fixtures/in-memory-db-mock');
    resetDatabaseInstances();
  } catch {
    // Ignore if reset fails
  }

  // Restore all mocks to prevent pollution between test files
  vi.restoreAllMocks();

  // Browser mocks are created fresh for each test instance
});
