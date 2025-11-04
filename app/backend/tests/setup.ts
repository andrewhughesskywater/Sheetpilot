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
// Tests run on Node.js (v127) but better-sqlite3 is compiled for Electron (v139)
// Uses INTERNAL in-memory database mock that stores data for proper test behavior
// IMPORTANT: Mock factory must be synchronous for Vitest to intercept require() calls
vi.mock('better-sqlite3', () => {
  console.log('[SETUP] Mock factory for better-sqlite3 is being called');
  // Use synchronous require() instead of async import()
  const { createInMemoryDatabase } = require('./fixtures/in-memory-db-mock');
  console.log('[SETUP] Successfully loaded in-memory-db-mock');
  
  // Store database instances per path - cleared between tests for isolation
  const databaseInstances = new Map<string, ReturnType<typeof createInMemoryDatabase>>();
  
  // Use a proper class to ensure constructor works correctly with 'new'
  class MockDatabase {
    path: string;
    open: boolean;
    prepare: ReturnType<typeof createInMemoryDatabase>['prepare'];
    transaction: ReturnType<typeof createInMemoryDatabase>['transaction'];
    exec: ReturnType<typeof createInMemoryDatabase>['exec'];
    close: ReturnType<typeof createInMemoryDatabase>['close'];
    pragma: ReturnType<typeof createInMemoryDatabase>['pragma'];
    
    constructor(path: string, _opts?: unknown) {
      console.log('[SETUP] MockDatabase constructor called with path:', path);
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
  }
  
  // For Vitest mocks with CommonJS, we need to export the constructor as default
  // The real better-sqlite3 module exports: module.exports = Database
  // Which means both require('better-sqlite3') and require('better-sqlite3').default work
  // We mimic this by making default the primary export
  
  const mockExport = MockDatabase;
  
  return {
    default: mockExport,
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
afterEach(() => {
  // Clear created database paths and instances between tests for isolation
  createdDbPaths.clear();
  // Browser mocks are created fresh for each test instance
  // Note: databaseInstances Map is scoped to the mock factory, so it persists
  // This is actually OK because each test uses a unique path (with Date.now())
});

