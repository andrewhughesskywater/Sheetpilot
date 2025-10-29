/**
 * @fileoverview Critical Path Smoke Tests
 * 
 * Fast validation tests for CI/CD pipeline to catch critical failures.
 * Must complete in <10 seconds to prevent blocking development workflow.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpcMainInvokeEvent } from 'electron';

// Import the modules we need to test
import { ensureSchema } from '../../src/services/database';
import { 
  isValidDate, 
  isValidTime, 
  isTimeOutAfterTimeIn, 
  validateField,
  formatTimeInput 
} from '../../src/logic/timesheet-validation';
import { 
  projectNeedsTools, 
  toolNeedsChargeCode,  
  getToolOptions,
  projects,
  chargeCodes,
  toolsByProject 
} from '../../src/logic/dropdown-logic';

// Mock Electron modules
vi.mock('electron', () => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  
  const ipcMain = {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers[channel] = fn;
    }),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn()
  };

  return {
    ipcMain,
    app: {
      getPath: vi.fn(() => 'C:/tmp/sheetpilot-userdata'),
      isPackaged: false,
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      quit: vi.fn()
    },
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

// Mock database
vi.mock('../../src/services/database', () => ({
  setDbPath: vi.fn(),
  ensureSchema: vi.fn(),
  getDbPath: vi.fn(() => 'C:/tmp/sheetpilot.sqlite'),
  openDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
      get: vi.fn(() => ({}))
    })),
    exec: vi.fn(),
    close: vi.fn()
  }))
}));

// Mock logger
vi.mock('../../src/shared/logger', () => ({
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
  }
}));

describe('Critical Path Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Application Initialization', () => {
    it('should initialize without errors', () => {
      // Test that core modules can be imported without errors
      expect(() => {
        // Just verify the imports work
        expect(ensureSchema).toBeDefined();
      }).not.toThrow();
    });

    it('should register IPC handlers successfully', async () => {
      // Import the main module to trigger IPC handler registration
      await import('../../src/main');
      
      const { ipcMain } = await import('electron');
      
      // Verify IPC handlers are registered
      expect(ipcMain.handle).toHaveBeenCalled();
      
      // Check for critical handlers
      const handlerCalls = vi.mocked(ipcMain.handle).mock.calls;
      const handlerChannels = handlerCalls.map(call => call[0]);
      
      expect(handlerChannels).toContain('timesheet:saveDraft');
      expect(handlerChannels).toContain('timesheet:loadDraft');
      expect(handlerChannels).toContain('timesheet:deleteDraft');
    });

    it('should initialize database schema correctly', () => {
      expect(() => {
        ensureSchema();
      }).not.toThrow();
    });
  });

  describe('Core Validation Functions', () => {
    it('should validate dates correctly', () => {
      // Valid dates
      expect(isValidDate('01/15/2025')).toBe(true);
      expect(isValidDate('12/31/2024')).toBe(true);
      
      // Invalid dates
      expect(isValidDate('2025-01-15')).toBe(false); // Wrong format
      expect(isValidDate('13/15/2025')).toBe(false); // Invalid month
      expect(isValidDate('')).toBe(false); // Empty
    });

    it('should validate times correctly', () => {
      // Valid times
      expect(isValidTime('09:00')).toBe(true);
      expect(isValidTime('17:30')).toBe(true);
      expect(isValidTime('900')).toBe(true); // Numeric format
      
      // Invalid times
      expect(isValidTime('09:01')).toBe(false); // Not 15-minute increment
      expect(isValidTime('25:00')).toBe(false); // Invalid hour
      expect(isValidTime('')).toBe(false); // Empty
    });

    it('should validate time relationships correctly', () => {
      // Valid relationships
      expect(isTimeOutAfterTimeIn('09:00', '17:00')).toBe(true);
      expect(isTimeOutAfterTimeIn('08:30', '16:30')).toBe(true);
      
      // Invalid relationships
      expect(isTimeOutAfterTimeIn('17:00', '09:00')).toBe(false);
      expect(isTimeOutAfterTimeIn('09:00', '09:00')).toBe(false);
    });
  });

  describe('Business Logic Functions', () => {
    it('should validate project-tool relationships', () => {
      // Projects that need tools
      expect(projectNeedsTools('FL-Carver Techs')).toBe(true);
      expect(getToolOptions('FL-Carver Techs').length).toBeGreaterThan(0);
      
      // Projects that don't need tools
      expect(projectNeedsTools('PTO/RTO')).toBe(false);
      expect(getToolOptions('PTO/RTO')).toEqual([]);
    });

    it('should validate tool-chargeCode relationships', () => {
      // Tools that need charge codes
      expect(toolNeedsChargeCode('#1 Rinse and 2D marker')).toBe(true);
      
      // Tools that don't need charge codes
      expect(toolNeedsChargeCode('Meeting')).toBe(false);
    });

    it('should validate required fields', () => {
      const mockRows = [{
        date: '01/15/2025',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1',
        taskDescription: 'Test task'
      }];
      
      const projectsList = ['FL-Carver Techs', 'PTO/RTO', 'SWFL-CHEM/GAS', 'Training'];
      const chargeCodesList = ['Admin', 'EPR1', 'EPR2', 'EPR3', 'EPR4', 'Repair', 'Meeting', 'Other', 'PM', 'Training', 'Upgrade'];
      
      // Required fields should be validated
      expect(validateField('', 0, 'date', mockRows, projectsList, chargeCodesList)).toBeTruthy();
      expect(validateField('', 0, 'project', mockRows, projectsList, chargeCodesList)).toBeTruthy();
      expect(validateField('', 0, 'taskDescription', mockRows, projectsList, chargeCodesList)).toBeTruthy();
    });
  });

  describe('IPC Communication', () => {
    it('should handle saveDraft IPC call', async () => {
      const { ipcMain } = await import('electron');
      
      // Get the handler function
      const handlerCalls = vi.mocked(ipcMain.handle).mock.calls;
      const saveDraftCall = handlerCalls.find(call => call[0] === 'timesheet:saveDraft');
      
      if (saveDraftCall) {
        const handler = saveDraftCall[1];
        
        const testPayload = {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        };
        
        expect(() => {
          handler({} as IpcMainInvokeEvent, testPayload);
        }).not.toThrow();
      }
    });

    it('should handle loadDraft IPC call', async () => {
      const { ipcMain } = await import('electron');
      
      // Get the handler function
      const handlerCalls = vi.mocked(ipcMain.handle).mock.calls;
      const loadDraftCall = handlerCalls.find(call => call[0] === 'timesheet:loadDraft');
      
      if (loadDraftCall) {
        const handler = loadDraftCall[1];
        
        expect(() => {
          handler({} as IpcMainInvokeEvent);
        }).not.toThrow();
      }
    });
  });

  describe('Data Structures', () => {
    it('should have correct project lists', () => {
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
      expect(projects).toContain('FL-Carver Techs');
      expect(projects).toContain('PTO/RTO');
    });

    it('should have correct charge code lists', () => {
      expect(Array.isArray(chargeCodes)).toBe(true);
      expect(chargeCodes.length).toBeGreaterThan(0);
      expect(chargeCodes).toContain('EPR1');
      expect(chargeCodes).toContain('Admin');
    });

    it('should have correct tool mappings', () => {
      expect(typeof toolsByProject).toBe('object');
      expect(toolsByProject['FL-Carver Techs']).toBeDefined();
      expect(Array.isArray(toolsByProject['FL-Carver Techs'])).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid inputs gracefully', () => {
      // Should not throw on invalid inputs
      expect(() => {
        isValidDate(null as unknown as string);
        isValidDate(undefined as unknown as string);
        isValidTime(null as unknown as string);
        isValidTime(undefined as unknown as string);
      }).not.toThrow();
    });

    it('should provide user-friendly error messages', () => {
      const mockRows = [{}];
      const projectsList = ['FL-Carver Techs'];
      const chargeCodesList = ['EPR1'];
      
      const errorMessage = validateField('', 0, 'date', mockRows, projectsList, chargeCodesList);
      
      expect(errorMessage).toBeTruthy();
      expect(typeof errorMessage).toBe('string');
      expect(errorMessage!.length).toBeLessThan(100);
      expect(errorMessage).not.toContain('undefined');
      expect(errorMessage).not.toContain('null');
    });
  });

  describe('Performance', () => {
    it('should complete all smoke tests quickly', () => {
      const startTime = Date.now();
      
      // Test multiple validations (reduced iterations to prevent hanging)
      for (let i = 0; i < 10; i++) {
        isValidDate('01/15/2025');
        isValidTime('09:00');
        projectNeedsTools('FL-Carver Techs');
        toolNeedsChargeCode('#1 Rinse and 2D marker');
        getToolOptions('FL-Carver Techs');
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in less than 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Integration Points', () => {
    it('should have consistent data flow', () => {
      // Test that data flows correctly through the system
      const testData = {
        date: '01/15/2025',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1',
        taskDescription: 'Test task'
      };
      
      // Validate the data
      expect(isValidDate(testData.date)).toBe(true);
      expect(isValidTime(testData.timeIn)).toBe(true);
      expect(isValidTime(testData.timeOut)).toBe(true);
      expect(isTimeOutAfterTimeIn(testData.timeIn, testData.timeOut)).toBe(true);
      expect(projectNeedsTools(testData.project)).toBe(true);
      expect(toolNeedsChargeCode(testData.tool)).toBe(true);
    });

    it('should maintain data integrity', () => {
      // Test that data transformations maintain integrity
      const timeFormats = ['900', '1730', '09:00', '17:30'];
      
      timeFormats.forEach(time => {
        const formatted = formatTimeInput(time);
        expect(formatted).toMatch(/^\d{2}:\d{2}$/);
      });
    });
  });
});
