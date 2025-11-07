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
    }
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
    __esModule: true
  };
});

// Mock Playwright to prevent browser automation in tests
// Creates consistent mock objects that support proper lifecycle management

// Helper to create a mock locator
function createMockLocator() {
  return {
    fill: vi.fn(() => Promise.resolve()),
    click: vi.fn(() => Promise.resolve()),
    type: vi.fn(() => Promise.resolve()),
    waitFor: vi.fn(() => Promise.resolve()),
    isVisible: vi.fn(() => Promise.resolve(true)),
    first: vi.fn(function() { return this; }),
    nth: vi.fn(function() { return this; })
  };
}

// Helper to create a mock page
function createMockPage() {
  const mockPage = {
    goto: vi.fn(() => Promise.resolve({ url: () => 'http://localhost' })),
    fill: vi.fn(() => Promise.resolve()),
    click: vi.fn(() => Promise.resolve()),
    waitForSelector: vi.fn(() => Promise.resolve(createMockLocator())),
    locator: vi.fn(() => createMockLocator()),
    url: vi.fn(() => 'http://localhost'),
    evaluate: vi.fn(() => Promise.resolve({})),
    on: vi.fn(),
    off: vi.fn(),
    close: vi.fn(() => Promise.resolve())
  };
  return mockPage;
}

// Helper to create a mock context that shares the same page
function createMockContext(page: ReturnType<typeof createMockPage>) {
  return {
    newPage: vi.fn(() => Promise.resolve(page)),
    close: vi.fn(() => Promise.resolve()),
    pages: vi.fn(() => [page]),
    addInitScript: vi.fn(() => Promise.resolve()),
    route: vi.fn(() => Promise.resolve()),
    unroute: vi.fn(() => Promise.resolve())
  };
}

// Helper to create a mock browser with consistent page/context
function createMockBrowser() {
  const mockPage = createMockPage();
  const mockContext = createMockContext(mockPage);
  
  return {
    newContext: vi.fn(() => Promise.resolve(mockContext)),
    newPage: vi.fn(() => Promise.resolve(mockPage)),
    contexts: vi.fn(() => [mockContext]),
    close: vi.fn(() => Promise.resolve()),
    isConnected: vi.fn(() => true),
    version: vi.fn(() => '1.0.0')
  };
}

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve(createMockBrowser()))
  }
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
    exit: vi.fn()
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeHandler: vi.fn()
  },
  BrowserWindow: vi.fn(),
  dialog: {
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
    showOpenDialog: vi.fn(() => Promise.resolve({ filePaths: [] })),
    showSaveDialog: vi.fn(() => Promise.resolve({ filePath: '' }))
  },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 }
    }))
  }
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
  // Browser mocks are created fresh for each test instance
});

