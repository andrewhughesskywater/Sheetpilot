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
    handle: vi.fn((channel: string, fn: any) => {
      // Wrap handler to skip the event parameter when called from tests
      globalThis.__test_handlers[channel] = async (...args: any[]) => {
        // Call the actual handler with null event and the provided args
        return fn(null, ...args);
      };
      return undefined;
    }),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn()
  };

  return {
    app: {
      getPath: vi.fn((key: string) => (key === 'userData' ? 'C:/tmp/sheetpilot-userdata' : 'C:/tmp')),
      isPackaged: false,
      whenReady: vi.fn(() => ({
        then: (callback: () => void) => {
          // Don't execute callback automatically to prevent side effects
          return Promise.resolve();
        },
        catch: () => Promise.resolve()
      })),
      on: vi.fn(),
      quit: vi.fn()
    },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 }
      }))
    },
    ipcMain,
    BrowserWindow: vi.fn().mockImplementation(() => ({
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      once: vi.fn(),
      on: vi.fn(),
      show: vi.fn(),
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
    storeCredentials: vi.fn(),
    getCredentials: vi.fn(),
    listCredentials: vi.fn(),
    deleteCredentials: vi.fn(),
    openDb: vi.fn(() => mockDbInstance),
    getPendingTimesheetEntries: vi.fn(() => []),
    getSubmittedTimesheetEntriesForExport: vi.fn(() => [])
  };
});

// Mock timesheet importer
vi.mock('../src/services/timesheet_importer', () => ({
  submitTimesheets: vi.fn(async () => ({ 
    ok: true, 
    submittedIds: [1], 
    removedIds: [], 
    totalProcessed: 1, 
    successCount: 1, 
    removedCount: 0 
  }))
}));

// Mock logger
vi.mock('../src/shared/logger', () => ({
  initializeLogging: vi.fn(),
  appLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    audit: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() }))
  },
  dbLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    audit: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() }))
  },
  ipcLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    audit: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() }))
  }
}));

// Import after mocks
import { registerIPCHandlers } from '../main';
import * as db from '../src/services/database';
import * as imp from '../src/services/timesheet_importer';

describe('IPC Handlers Comprehensive Tests', () => {
  let testDbPath: string;
  let handlers: Record<string, Function>;

  beforeEach(() => {
    // Create isolated test database
    testDbPath = path.join(os.tmpdir(), `sheetpilot-ipc-test-${Date.now()}.sqlite`);
    
    // Reset all mocks (this clears call history AND implementations)
    vi.clearAllMocks();
    
    // Re-setup mockDbInstance after clearAllMocks
    mockDbInstance.prepare = vi.fn(() => ({ 
      all: vi.fn(() => []), 
      run: vi.fn(() => ({ changes: 1 })), 
      get: vi.fn(() => ({})) 
    }));
    mockDbInstance.exec = vi.fn();
    mockDbInstance.close = vi.fn();
    
    // Re-setup openDb mock to return mockDbInstance
    (db as any).openDb.mockImplementation(() => mockDbInstance);
    
    // Setup handlers for testing
    if (!globalThis.__test_handlers) {
      globalThis.__test_handlers = {};
    }
    handlers = globalThis.__test_handlers;
    
    // Register handlers
    registerIPCHandlers();
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
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
      (db as any).storeCredentials.mockReturnValue({
        success: true,
        message: 'Credentials stored successfully',
        changes: 1
      });

      const result = await handlers['credentials:store']('test-service', 'user@test.com', 'password123');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Credentials stored successfully');
      expect((db as any).storeCredentials).toHaveBeenCalledWith('test-service', 'user@test.com', 'password123');
    });

    it('should handle storage failure', async () => {
      (db as any).storeCredentials.mockReturnValue({
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
      (db as any).getCredentials.mockReturnValue({
        email: 'user@test.com',
        password: 'password123'
      });

      const result = await handlers['credentials:get']('test-service');
      
      expect(result.success).toBe(true);
      expect(result.credentials.email).toBe('user@test.com');
      expect((db as any).getCredentials).toHaveBeenCalledWith('test-service');
    });

    it('should handle missing credentials', async () => {
      (db as any).getCredentials.mockReturnValue(null);

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
      (db as any).listCredentials.mockReturnValue(mockCredentials);

      const result = await handlers['credentials:list']();
      
      expect(result.success).toBe(true);
      expect(result.credentials).toEqual(mockCredentials);
      expect((db as any).listCredentials).toHaveBeenCalled();
    });

    it('should handle empty credentials list', async () => {
      (db as any).listCredentials.mockReturnValue([]);

      const result = await handlers['credentials:list']();
      
      expect(result.success).toBe(true);
      expect(result.credentials).toEqual([]);
    });
  });

  describe('credentials:delete handler', () => {
    it('should delete credentials successfully', async () => {
      (db as any).deleteCredentials.mockReturnValue({
        success: true,
        message: 'Credentials deleted successfully',
        changes: 1
      });

      const result = await handlers['credentials:delete']('test-service');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Credentials deleted successfully');
      expect((db as any).deleteCredentials).toHaveBeenCalledWith('test-service');
    });

    it('should handle deletion failure', async () => {
      (db as any).deleteCredentials.mockReturnValue({
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

      const result = await handlers['database:getAllTimesheetEntries']();
      
      expect(result.success).toBe(true);
      expect(result.entries).toEqual(mockEntries);
    });

    it('should handle empty entries list', async () => {
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({}))
      });

      const result = await handlers['database:getAllTimesheetEntries']();
      
      expect(result.success).toBe(true);
      expect(result.entries).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockDbInstance.prepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await handlers['database:getAllTimesheetEntries']();
      
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
      (db as any).getSubmittedTimesheetEntriesForExport.mockReturnValue(mockEntries);

      const result = await handlers['timesheet:exportToCSV']();
      
      expect(result.success).toBe(true);
      expect(result.csvData).toContain('Date,Start Time,End Time,Hours,Project,Tool,Charge Code,Task Description,Status,Submitted At');
      expect(result.csvData).toContain('2025-01-15,09:00,17:00,8,"Test Project","VS Code","DEV001","Test task",Complete,2025-01-15 17:00:00');
    });

    it('should handle empty data export', async () => {
      (db as any).getSubmittedTimesheetEntriesForExport.mockReturnValue([]);

      const result = await handlers['timesheet:exportToCSV']();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No submitted timesheet entries found');
    });

    it('should handle export errors', async () => {
      (db as any).getSubmittedTimesheetEntriesForExport.mockImplementation(() => {
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
      (db as any).openDb.mockReturnValue(mockDb);

      const result = await handlers['database:clearDatabase']();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Database cleared successfully');
      expect(mockDb.exec).toHaveBeenCalledWith('DELETE FROM timesheet');
      expect(mockDb.exec).toHaveBeenCalledWith('DELETE FROM credentials');
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle clear database errors', async () => {
      const mockDb = {
        exec: vi.fn(() => {
          throw new Error('Database locked');
        }),
        close: vi.fn()
      };
      (db as any).openDb.mockReturnValue(mockDb);

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

    it('should validate quarter constraints', async () => {
      const invalidRow = {
        date: '2024-01-15', // Different quarter (Q1 2024 vs Q4 2025)
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      };

      const result = await handlers['timesheet:saveDraft'](invalidRow);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not in the current quarter');
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
      (db as any).getCredentials.mockReturnValue({
        email: 'user@test.com',
        password: 'password123'
      });
      (imp as any).submitTimesheets.mockResolvedValue({
        ok: true,
        submittedIds: [1, 2],
        removedIds: [],
        totalProcessed: 2,
        successCount: 2,
        removedCount: 0
      });

      const result = await handlers['timesheet:submit']();
      
      expect(result.submitResult.ok).toBe(true);
      expect(result.submitResult.successCount).toBe(2);
      expect((imp as any).submitTimesheets).toHaveBeenCalledWith('user@test.com', 'password123');
    });

    it('should handle missing credentials', async () => {
      (db as any).getCredentials.mockReturnValue(null);

      const result = await handlers['timesheet:submit']();
      
      expect(result.error).toContain('credentials not found');
      expect((imp as any).submitTimesheets).not.toHaveBeenCalled();
    });

    it('should handle submission failures', async () => {
      (db as any).getCredentials.mockReturnValue({
        email: 'user@test.com',
        password: 'password123'
      });
      (imp as any).submitTimesheets.mockResolvedValue({
        ok: false,
        submittedIds: [],
        removedIds: [1, 2],
        totalProcessed: 2,
        successCount: 0,
        removedCount: 2
      });

      const result = await handlers['timesheet:submit']();
      
      expect(result.submitResult.ok).toBe(false);
      expect(result.submitResult.successCount).toBe(0);
      expect(result.submitResult.removedCount).toBe(2);
    });
  });
});
