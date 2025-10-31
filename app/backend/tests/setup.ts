/**
 * Vitest setup file
 * This file runs before all tests to configure the test environment
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

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
// Tests run on Node.js (v127) but better-sqlite3 is compiled for Electron (v139)
// Uses INTERNAL in-memory database mock that stores data for proper test behavior
vi.mock('better-sqlite3', async () => {
  const { createInMemoryDatabase } = await import('./fixtures/in-memory-db-mock');
  
  // Store database instances per path - cleared between tests for isolation
  const databaseInstances = new Map<string, ReturnType<typeof createInMemoryDatabase>>();
  
  function MockDatabase(this: MockDatabaseInstance, path: string, _opts?: unknown) {
    const pathModule = require('path');
    const resolvedPath = pathModule.resolve(path);
    createdDbPaths.add(resolvedPath);
    // Also track the directory
    const dir = pathModule.dirname(resolvedPath);
    createdDbPaths.add(dir);
    
    if (!databaseInstances.has(resolvedPath)) {
      databaseInstances.set(resolvedPath, createInMemoryDatabase(resolvedPath));
    }
    const db = databaseInstances.get(resolvedPath)!;
    this.path = resolvedPath;
    this.open = true;
    this.prepare = db.prepare.bind(db);
    this.transaction = db.transaction.bind(db);
    this.exec = db.exec.bind(db);
    this.close = db.close.bind(db);
    this.pragma = db.pragma.bind(db);
  }

  interface MockDatabaseInstance {
    path: string;
    open: boolean;
    prepare: ReturnType<typeof createInMemoryDatabase>['prepare'];
    transaction: ReturnType<typeof createInMemoryDatabase>['transaction'];
    exec: ReturnType<typeof createInMemoryDatabase>['exec'];
    close: ReturnType<typeof createInMemoryDatabase>['close'];
    pragma?: ReturnType<typeof createInMemoryDatabase>['pragma'];
  }
  
  // The mock module needs to work for both CommonJS require() and ES imports
  // CommonJS: require('better-sqlite3') should return a constructor function
  // ES: import Database from 'better-sqlite3' should get .default
  // The database code checks: mod.default ?? mod.Database ?? mod, then calls: new DatabaseCtor(path)
  // So we need MockDatabase to work as a constructor when called with 'new'
  // MockDatabase is already a constructor function, we just need to attach ES module properties
  
  // MockDatabase is already a constructor function that can be called with 'new'
  // We just need to attach ES module properties (.default and .Database)
  const mockModule = MockDatabase as unknown as {
    (path: string, opts?: unknown): MockDatabaseInstance;
    default: typeof MockDatabase;
    Database: typeof MockDatabase;
  };
  
  // Attach properties for ES module compatibility
  mockModule.default = MockDatabase;
  mockModule.Database = MockDatabase;
  
  return mockModule;
});

// Mock ResizeObserver immediately (must be before any code that uses it)
const ResizeObserverMock = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// eslint-disable-next-line no-undef
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock other browser APIs that might be missing
Object.defineProperty(globalThis.window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock requestIdleCallback
global.requestIdleCallback = vi.fn().mockImplementation((callback) => {
  setTimeout(callback, 0);
  return 1;
});

global.cancelIdleCallback = vi.fn();

// Mock Handsontable to prevent it from interfering with React
vi.mock('@handsontable/react-wrapper', () => ({
  HotTable: vi.fn(() => null),
  registerAllModules: vi.fn(),
}));

vi.mock('handsontable/registry', () => ({
  registerAllModules: vi.fn(),
}));

// Mock main Handsontable export
vi.mock('handsontable', () => ({
  default: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    render: vi.fn(),
    updateSettings: vi.fn(),
    getData: vi.fn(() => []),
    setData: vi.fn(),
    getCell: vi.fn(),
    setCellMeta: vi.fn(),
    getCellMeta: vi.fn(),
    addHook: vi.fn(),
    removeHook: vi.fn(),
    runHooks: vi.fn(),
    isDestroyed: vi.fn(() => false),
  })),
}));

vi.mock('handsontable/base', () => ({
  Core: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    render: vi.fn(),
    updateSettings: vi.fn(),
    getData: vi.fn(() => []),
    setData: vi.fn(),
    getCell: vi.fn(),
    setCellMeta: vi.fn(),
    getCellMeta: vi.fn(),
    addHook: vi.fn(),
    removeHook: vi.fn(),
    runHooks: vi.fn(),
    isDestroyed: vi.fn(() => false),
  })),
}));


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
    pages: vi.fn(() => [page])
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

// Clean up after each test to prevent memory leaks and test interference
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // Clear created database paths and instances between tests for isolation
  createdDbPaths.clear();
  // Browser mocks are created fresh for each test instance
  // Note: databaseInstances Map is scoped to the mock factory, so it persists
  // This is actually OK because each test uses a unique path (with Date.now())
});

