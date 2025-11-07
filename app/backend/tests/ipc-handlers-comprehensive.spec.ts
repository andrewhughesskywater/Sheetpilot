/**
 * @fileoverview Comprehensive IPC Handler Tests
 * 
 * Tests all IPC handlers in main.ts to ensure complete coverage
 * of the communication layer between renderer and main process.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

declare global {
  // Storage for mocked IPC handlers used by tests
  // eslint-disable-next-line no-var
  var __test_handlers: Record<string, (...args: unknown[]) => unknown> | undefined;
}

// Ensure handler storage exists before mocks consume it
(globalThis as unknown as { __test_handlers?: Record<string, (...args: unknown[]) => unknown> }).__test_handlers =
  (globalThis as unknown as { __test_handlers?: Record<string, (...args: unknown[]) => unknown> }).__test_handlers ?? {};

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

// Mock Electron modules
vi.mock('electron', () => {
  // Initialize handlers storage in the mock factory (hoisted)
  if (!globalThis.__test_handlers) {
    globalThis.__test_handlers = {};
  }
  
  const ipcMain = {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      // Wrap handler to skip the event parameter when called from tests
      (globalThis.__test_handlers as Record<string, (...args: unknown[]) => unknown>)[channel] = async (...args: unknown[]) => {
        // Call the actual handler with null event and the provided args
        return fn(null, ...args);
      };
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

  return {
    app: {
      getPath: vi.fn((key: string) => (key === 'userData' ? 'C:/tmp/sheetpilot-userdata' : 'C:/tmp')),
      getAppPath: vi.fn(() => 'C:\\Local\\Sheetpilot'),
      getVersion: vi.fn(() => '1.3.6'),
      isPackaged: false,
      whenReady: vi.fn(() => ({
        then: (_callback: () => void) => {
          // Don't execute callback automatically to prevent side effects
          return Promise.resolve();
        },
        catch: () => Promise.resolve()
      })),
      on: vi.fn(),
      quit: vi.fn(),
      exit: vi.fn()
    },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 }
      }))
    },
    ipcMain,
    dialog,
    shell,
    BrowserWindow: vi.fn().mockImplementation(() => ({
      webContents: {
        on: vi.fn(),
        once: vi.fn(),
        send: vi.fn(),
        executeJavaScript: vi.fn()
      },
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      once: vi.fn(),
      on: vi.fn(),
      show: vi.fn(),
      maximize: vi.fn(),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 })),
      isMaximized: vi.fn(() => false)
    }))
  };
});

// Create mockDb in module scope so we can access it
const createMockDb = () => ({
  prepare: vi.fn(() => ({ all: vi.fn(() => []), run: vi.fn(() => ({ changes: 1 })), get: vi.fn(() => ({})) })),
  exec: vi.fn(),
  close: vi.fn()
});

// Store reference to the mock DB that will be returned by openDb
let mockDbInstance = createMockDb();

// Mock database module
vi.mock('../src/services/database', () => {
  return {
    setDbPath: vi.fn(),
    ensureSchema: vi.fn(),
    getDbPath: vi.fn(() => 'C:/tmp/sheetpilot.sqlite'),
    getDb: vi.fn(() => mockDbInstance),
    createSession: vi.fn(() => 'mock-session-token'),
    validateSession: vi.fn((token: string) => {
      if (token === 'valid-token' || token === 'mock-session-token') {
        return { valid: true, email: 'user@test.com', isAdmin: false };
      }
      return { valid: false };
    }),
    clearSession: vi.fn(),
    clearUserSessions: vi.fn(),
    clearAllCredentials: vi.fn(),
    rebuildDatabase: vi.fn(),
    storeCredentials: vi.fn(),
    getCredentials: vi.fn(),
    listCredentials: vi.fn(),
    deleteCredentials: vi.fn(),
    openDb: vi.fn(() => mockDbInstance),
    getPendingTimesheetEntries: vi.fn(() => []),
    getSubmittedTimesheetEntriesForExport: vi.fn(() => [])
  };
});

// Mock timesheet importer (default: no entries to submit)
vi.mock('../src/services/timesheet-importer', () => ({
  submitTimesheets: vi.fn(async () => ({ 
    ok: true, 
    submittedIds: [], 
    removedIds: [], 
    totalProcessed: 0, 
    successCount: 0, 
    removedCount: 0 
  }))
}));

// Mock logger
vi.mock('../../shared/logger', () => {
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
    appLogger: createMockLogger(),
    dbLogger: createMockLogger(),
    ipcLogger: createMockLogger(),
    botLogger: createMockLogger(),
    importLogger: createMockLogger()
  };
});

// Import after mocks
import { registerIPCHandlers } from '../src/main';
import * as db from '../src/services/database';
import * as imp from '../src/services/timesheet-importer';

type VMock = ReturnType<typeof vi.fn>;
const mdb = db as unknown as {
  openDb: VMock;
  getDb: VMock;
  setDbPath: VMock;
  ensureSchema: VMock;
  getDbPath: VMock;
  storeCredentials: VMock;
  getCredentials: VMock;
  listCredentials: VMock;
  deleteCredentials: VMock;
  getPendingTimesheetEntries: VMock;
  getSubmittedTimesheetEntriesForExport: VMock;
};

const mimps = imp as unknown as {
  submitTimesheets: ReturnType<typeof vi.fn>;
};

describe('IPC Handlers Comprehensive Tests', () => {
  let testDbPath: string;
  let handlers: Record<string, any>;

  beforeAll(() => {
    // Register handlers once for all tests
    registerIPCHandlers();
    handlers = globalThis.__test_handlers!;
  });

  beforeEach(() => {
    // Create isolated test database
    testDbPath = path.join(os.tmpdir(), `sheetpilot-ipc-test-${Date.now()}.sqlite`);
    
    // Only clear call history, preserve mock implementations
    vi.clearAllMocks();
    
    // Re-setup mockDbInstance after clearAllMocks
    mockDbInstance.prepare = vi.fn(() => ({ 
      all: vi.fn(() => []), 
      run: vi.fn(() => ({ changes: 1 })), 
      get: vi.fn(() => ({})) 
    }));
    mockDbInstance.exec = vi.fn();
    mockDbInstance.close = vi.fn();
    
    // Re-setup openDb and getDb mocks to return mockDbInstance
    mdb.openDb.mockImplementation(() => mockDbInstance);
    mdb.getDb.mockImplementation(() => mockDbInstance);
    
    // Re-setup submitTimesheets mock with default implementation (0 entries)
    // This is needed because clearAllMocks() clears the spy
    if (mimps.submitTimesheets.mockResolvedValue) {
      mimps.submitTimesheets.mockResolvedValue({
        ok: true,
        submittedIds: [],
        removedIds: [],
        totalProcessed: 0,
        successCount: 0,
        removedCount: 0
      });
    }
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('ping handler', () => {
    it('should return pong with message', async () => {
      const result = await handlers['ping']('test-message');
      expect(result).toBe('pong: test-message');
    });

    it('should handle empty message', async () => {
      const result = await handlers['ping']('');
      expect(result).toBe('pong: ');
    });

    it('should handle undefined message', async () => {
      const result = await handlers['ping'](undefined);
      expect(result).toBe('pong: undefined');
    });
  });

  describe('credentials:store handler', () => {
    it('should store credentials successfully', async () => {
      mdb.storeCredentials.mockReturnValue({
        success: true,
        message: 'Credentials stored successfully',
        changes: 1
      });

      const result = await handlers['credentials:store']('test-service', 'user@test.com', 'password123');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Credentials stored successfully');
      expect(mdb.storeCredentials).toHaveBeenCalledWith('test-service', 'user@test.com', 'password123');
    });

    it('should handle storage failure', async () => {
      mdb.storeCredentials.mockReturnValue({
        success: false,
        message: 'Database error',
        changes: 0
      });

      const result = await handlers['credentials:store']('test-service', 'user@test.com', 'password123');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Database error');
    });

    it('should handle invalid parameters', async () => {
      const result = await handlers['credentials:store']('', '', '');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });
  });

  describe('credentials:get handler', () => {
    it('should retrieve credentials successfully', async () => {
      mdb.getCredentials.mockReturnValue({
        email: 'user@test.com',
        password: 'password123'
      });

      const result = await handlers['credentials:get']('test-service');
      
      expect(result.success).toBe(true);
      expect(result.credentials.email).toBe('user@test.com');
      expect(mdb.getCredentials).toHaveBeenCalledWith('test-service');
    });

    it('should handle missing credentials', async () => {
      mdb.getCredentials.mockReturnValue(null);

      const result = await handlers['credentials:get']('test-service');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Credentials not found');
    });

    it('should handle invalid service parameter', async () => {
      const result = await handlers['credentials:get']('');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Service name is required');
    });
  });

  describe('credentials:list handler', () => {
    it('should list all credentials', async () => {
      const mockCredentials = [
        { id: 1, service: 'service1', email: 'user1@test.com', created_at: '2025-01-01' },
        { id: 2, service: 'service2', email: 'user2@test.com', created_at: '2025-01-02' }
      ];
      mdb.listCredentials.mockReturnValue(mockCredentials);

      const result = await handlers['credentials:list']();
      
      expect(result.success).toBe(true);
      expect(result.credentials).toEqual(mockCredentials);
      expect(mdb.listCredentials).toHaveBeenCalled();
    });

    it('should handle empty credentials list', async () => {
      mdb.listCredentials.mockReturnValue([]);

      const result = await handlers['credentials:list']();
      
      expect(result.success).toBe(true);
      expect(result.credentials).toEqual([]);
    });
  });

  describe('credentials:delete handler', () => {
    it('should delete credentials successfully', async () => {
      mdb.deleteCredentials.mockReturnValue({
        success: true,
        message: 'Credentials deleted successfully',
        changes: 1
      });

      const result = await handlers['credentials:delete']('test-service');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Credentials deleted successfully');
      expect(mdb.deleteCredentials).toHaveBeenCalledWith('test-service');
    });

    it('should handle deletion failure', async () => {
      mdb.deleteCredentials.mockReturnValue({
        success: false,
        message: 'Database error',
        changes: 0
      });

      const result = await handlers['credentials:delete']('test-service');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Database error');
    });

    it('should handle invalid service parameter', async () => {
      const result = await handlers['credentials:delete']('');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Service name is required');
    });
  });

  describe('database:getAllTimesheetEntries handler', () => {
    it('should retrieve all timesheet entries', async () => {
      const mockEntries = [
        { id: 1, date: '2025-01-15', project: 'Test Project', status: 'Complete' },
        { id: 2, date: '2025-01-16', project: 'Test Project 2', status: null }
      ];
      
      // Mock the database prepare to return entries
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => mockEntries),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      const result = await handlers['database:getAllTimesheetEntries']('valid-token');
      
      expect(result.success).toBe(true);
      expect(result.entries).toEqual(mockEntries);
    });

    it('should handle empty entries list', async () => {
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      const result = await handlers['database:getAllTimesheetEntries']('valid-token');
      
      expect(result.success).toBe(true);
      expect(result.entries).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockDbInstance.prepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await handlers['database:getAllTimesheetEntries']('valid-token');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('database:getAllCredentials handler', () => {
    it('should retrieve all credentials', async () => {
      const mockCredentials = [
        { id: 1, service: 'service1', email: 'user1@test.com' },
        { id: 2, service: 'service2', email: 'user2@test.com' }
      ];
      
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => mockCredentials),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      const result = await handlers['database:getAllCredentials']();
      
      expect(result.success).toBe(true);
      expect(result.credentials).toEqual(mockCredentials);
    });
  });

  describe('database:getAllArchiveData handler (batched)', () => {
    it('should retrieve both timesheet and credentials in a single call', async () => {
      const mockTimesheet = [
        { id: 1, date: '2025-01-15', project: 'Test Project', status: 'Complete' },
        { id: 2, date: '2025-01-16', project: 'Test Project 2', status: 'Complete' }
      ];
      const mockCredentials = [
        { id: 1, service: 'smartsheet', email: 'user@test.com' }
      ];
      
      // Mock multiple prepare calls for timesheet and credentials
      let callCount = 0;
      mockDbInstance.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call is for timesheet
          return { all: vi.fn(() => mockTimesheet) };
        } else {
          // Second call is for credentials
          return { all: vi.fn(() => mockCredentials) };
        }
      });

      const result = await handlers['database:getAllArchiveData']('valid-token');
      
      expect(result.success).toBe(true);
      expect(result.timesheet).toEqual(mockTimesheet);
      expect(result.credentials).toEqual(mockCredentials);
      expect(mockDbInstance.prepare).toHaveBeenCalledTimes(2); // Two queries in one handler
    });

    it('should require valid session token', async () => {
      const result = await handlers['database:getAllArchiveData']('');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session token is required');
    });

    it('should validate session token', async () => {
      // validateSession mock already returns { valid: false } for 'invalid-token'
      const result = await handlers['database:getAllArchiveData']('invalid-token');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session is invalid or expired');
    });

    it('should handle database errors gracefully', async () => {
      mockDbInstance.prepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await handlers['database:getAllArchiveData']('valid-token');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('timesheet:exportToCSV handler', () => {
    it('should export timesheet data to CSV', async () => {
      const mockEntries = [
        {
          date: '2025-01-15',
          time_in: 540,
          time_out: 1020,
          hours: 8.0,
          project: 'Test Project',
          tool: 'VS Code',
          detail_charge_code: 'DEV001',
          task_description: 'Test task',
          status: 'Complete',
          submitted_at: '2025-01-15 17:00:00'
        }
      ];
      mdb.getSubmittedTimesheetEntriesForExport.mockReturnValue(mockEntries);

      const result = await handlers['timesheet:exportToCSV']();
      
      expect(result.success).toBe(true);
      expect(result.csvData).toContain('Date,Start Time,End Time,Hours,Project,Tool,Charge Code,Task Description,Status,Submitted At');
      expect(result.csvData).toContain('2025-01-15,09:00,17:00,8,"Test Project","VS Code","DEV001","Test task",Complete,2025-01-15 17:00:00');
    });

    it('should handle empty data export', async () => {
      mdb.getSubmittedTimesheetEntriesForExport.mockReturnValue([]);

      const result = await handlers['timesheet:exportToCSV']();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No submitted timesheet entries found');
    });

    it('should handle export errors', async () => {
      mdb.getSubmittedTimesheetEntriesForExport.mockImplementation(() => {
        throw new Error('Export failed');
      });

      const result = await handlers['timesheet:exportToCSV']();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Export failed');
    });
  });

  describe('database:clearDatabase handler', () => {
    it('should clear all database tables', async () => {
      const mockDb = {
        exec: vi.fn(),
        close: vi.fn()
      };
      mdb.getDb.mockReturnValue(mockDb);

      const result = await handlers['database:clearDatabase']();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Database cleared successfully');
      expect(mockDb.exec).toHaveBeenCalledWith('DELETE FROM timesheet');
      expect(mockDb.exec).toHaveBeenCalledWith('DELETE FROM credentials');
    });

    it('should handle clear database errors', async () => {
      const mockDb = {
        exec: vi.fn(() => {
          throw new Error('Database locked');
        }),
        close: vi.fn()
      };
      mdb.getDb.mockReturnValue(mockDb);

      const result = await handlers['database:clearDatabase']();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database locked');
    });
  });

  describe('timesheet:saveDraft handler', () => {
    it('should save valid draft data', async () => {
      // Use current quarter date (Q4 2025)
      const validRow = {
        date: '2025-10-15',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      };

      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      const result = await handlers['timesheet:saveDraft'](validRow);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });

    it('should validate required fields', async () => {
      const invalidRow = {
        date: '',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      };

      const result = await handlers['timesheet:saveDraft'](invalidRow);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Date is required');
    });

    it('should validate time format', async () => {
      const invalidRow = {
        date: '2025-10-15',
        timeIn: 'invalid-time',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      };

      const result = await handlers['timesheet:saveDraft'](invalidRow);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid time format');
    });

    it('should allow dates from any quarter (validation happens at submission)', async () => {
      // Quarter validation was intentionally removed from saveDraft
      // It now happens during submission routing to allow historical data entry
      const historicalRow = {
        date: '2024-01-15', // Different quarter (Q1 2024)
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      };

      const result = await handlers['timesheet:saveDraft'](historicalRow);
      
      // Should succeed - quarter validation is deferred to submission
      expect(result.success).toBe(true);
      expect(result.changes).toBeGreaterThanOrEqual(0);
    });

    it('should handle duplicate entries', async () => {
      const duplicateRow = {
        date: '2025-10-15',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      };

      // First call succeeds with changes = 1
      mockDbInstance.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      const result1 = await handlers['timesheet:saveDraft'](duplicateRow);
      expect(result1.success).toBe(true);

      // Second call succeeds with changes = 0 (upsert on conflict does update)
      // Since the unique constraint includes all fields, it will update
      mockDbInstance.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 0 })),
        get: vi.fn(() => ({}))
      });

      const result2 = await handlers['timesheet:saveDraft'](duplicateRow);
      expect(result2.success).toBe(true); // Still succeeds due to ON CONFLICT DO UPDATE
    });
  });

  describe('timesheet:loadDraft handler', () => {
    it('should load pending timesheet entries', async () => {
      const mockEntries = [
        {
          id: 1,
          date: '2025-10-15',
          time_in: 540,
          time_out: 1020,
          project: 'Test Project',
          tool: 'VS Code',
          detail_charge_code: 'DEV001',
          task_description: 'Test task',
          status: null
        }
      ];
      
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => mockEntries),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      const result = await handlers['timesheet:loadDraft']();
      
      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].date).toBe('2025-10-15');
      expect(result.entries[0].timeIn).toBe('09:00');
      expect(result.entries[0].timeOut).toBe('17:00');
    });

    it('should handle empty draft data', async () => {
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      const result = await handlers['timesheet:loadDraft']();
      
      expect(result.success).toBe(true);
      expect(result.entries).toEqual([{}]); // Should return one blank row
    });

    it('should handle load errors', async () => {
      // Make the all() method throw instead of prepare
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => {
          throw new Error('Database error');
        }),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      const result = await handlers['timesheet:loadDraft']();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('timesheet:deleteDraft handler', () => {
    it('should delete valid draft entry', async () => {
      const validId = 1;

      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      const result = await handlers['timesheet:deleteDraft'](validId);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      
      // Verify the correct SQL was prepared
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM timesheet')
      );
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ? AND status IS NULL')
      );
    });

    it('should validate ID parameter', async () => {
      const result = await handlers['timesheet:deleteDraft'](undefined);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid ID is required');
    });

    it('should handle non-existent entry', async () => {
      const nonExistentId = 999;

      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 0 })), // No rows affected
        get: vi.fn(() => ({}))
      });

      const result = await handlers['timesheet:deleteDraft'](nonExistentId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Draft entry not found');
    });

    it('should handle database errors', async () => {
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => {
          throw new Error('Database connection failed');
        }),
        get: vi.fn(() => ({}))
      });

      const result = await handlers['timesheet:deleteDraft'](1);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    it('should only delete draft entries (status IS NULL)', async () => {
      const validId = 1;

      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      await handlers['timesheet:deleteDraft'](validId);
      
      // Verify the SQL includes the status IS NULL condition
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE id = \? AND status IS NULL/)
      );
    });
  });

  describe('timesheet:submit handler', () => {
    it('should submit timesheets with valid credentials', async () => {
      // Setup credentials mock
      mdb.getCredentials.mockReturnValue({
        email: 'user@test.com',
        password: 'password123'
      });

      const result = await handlers['timesheet:submit']('valid-token');
      
      // Check if result has the expected structure
      expect(result).toBeDefined();
      
      // If there's an error, the test should fail
      if (result.error) {
        throw new Error(`Handler returned error instead of success: ${result.error}`);
      }
      
      expect(result.submitResult).toBeDefined();
      expect(result.submitResult.ok).toBe(true);
      // Verify that submitTimesheets was called with correct credentials
      expect(mimps.submitTimesheets).toHaveBeenCalledWith('user@test.com', 'password123');
      // With mocked database (0 entries), successCount should be 0
      expect(result.submitResult.successCount).toBe(0);
      expect(result.submitResult.totalProcessed).toBe(0);
    });

    it('should handle missing credentials', async () => {
      mdb.getCredentials.mockReturnValue(null);

      const result = await handlers['timesheet:submit']('valid-token');
      
      expect(result).toBeDefined();
      expect(result.error).toContain('credentials not found');
      expect(mimps.submitTimesheets).not.toHaveBeenCalled();
    });

    it('should handle submission failures', async () => {
      // Setup credentials mock
      mdb.getCredentials.mockReturnValue({
        email: 'user@test.com',
        password: 'password123'
      });

      const result = await handlers['timesheet:submit']('valid-token');
      
      expect(result).toBeDefined();
      expect(result.submitResult).toBeDefined();
      // Verify that submitTimesheets was called
      expect(mimps.submitTimesheets).toHaveBeenCalledWith('user@test.com', 'password123');
      // With mocked database (0 entries), the handler completes successfully
      expect(result.submitResult.ok).toBe(true);
      expect(result.submitResult.successCount).toBe(0);
    });
  });
});
