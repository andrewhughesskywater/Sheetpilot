/**
 * @fileoverview Timesheet Persistence Module Tests
 * 
 * Tests for localStorage backup, batch database saves, and orphan cleanup.
 * Critical for data integrity and preventing data loss.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveLocalBackup, batchSaveToDatabase, deleteDraftRows } from '../../../src/components/timesheet/timesheet.persistence';
import type { TimesheetRow } from '../../../src/components/timesheet/timesheet.schema';

interface MockStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  length: number;
  key: (index: number) => string | null;
}

describe('Timesheet Persistence Module', () => {
  let mockLocalStorage: Record<string, string>;
  let mockWindow: {
    timesheet: {
      saveDraft: ReturnType<typeof vi.fn>;
      loadDraft: ReturnType<typeof vi.fn>;
      deleteDraft: ReturnType<typeof vi.fn>;
    };
    logger: {
      debug: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      info: ReturnType<typeof vi.fn>;
      verbose: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    // Mock localStorage using vi.stubGlobal (jsdom provides localStorage as read-only)
    mockLocalStorage = {};
    const mockStorageImpl: MockStorage = {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        mockLocalStorage = {};
      },
      length: 0,
      key: () => null
    };
    vi.stubGlobal('localStorage', mockStorageImpl);

    // Mock window
    mockWindow = {
      timesheet: {
        saveDraft: vi.fn().mockResolvedValue({ success: true }),
        loadDraft: vi.fn().mockResolvedValue({ success: true, entries: [] }),
        deleteDraft: vi.fn().mockResolvedValue({ success: true })
      },
      logger: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        verbose: vi.fn()
      }
    };
    
    (global as {window?: unknown}).window = mockWindow;
  });

  describe('saveLocalBackup', () => {
    it('should save complete rows to localStorage', () => {
      const data: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Test Project',
          taskDescription: 'Test task'
        }
      ];
      
      saveLocalBackup(data);
      
      const stored = mockLocalStorage['sheetpilot_timesheet_backup'];
      expect(stored).toBeDefined();
      
      const parsed = JSON.parse(stored);
      expect(parsed.data).toHaveLength(1);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should filter out empty rows before saving', () => {
      const data: TimesheetRow[] = [
        {
          date: '01/15/2025',
          project: 'Test'
        },
        {}, // Empty row
        {} // Empty row
      ];
      
      saveLocalBackup(data);
      
      const stored = mockLocalStorage['sheetpilot_timesheet_backup'];
      const parsed = JSON.parse(stored);
      
      expect(parsed.data).toHaveLength(1); // Only non-empty row
    });

    it('should save timestamp with data', () => {
      const data: TimesheetRow[] = [{ date: '01/15/2025' }];
      
      const beforeTime = new Date().toISOString();
      saveLocalBackup(data);
      const afterTime = new Date().toISOString();
      
      const stored = mockLocalStorage['sheetpilot_timesheet_backup'];
      const parsed = JSON.parse(stored);
      
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.timestamp >= beforeTime).toBe(true);
      expect(parsed.timestamp <= afterTime).toBe(true);
    });

    it('should handle empty array', () => {
      const data: TimesheetRow[] = [];
      
      saveLocalBackup(data);
      
      const stored = mockLocalStorage['sheetpilot_timesheet_backup'];
      const parsed = JSON.parse(stored);
      
      expect(parsed.data).toEqual([]);
    });

    it('should handle storage quota exceeded', () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      
      // Should not throw
      expect(() => {
        saveLocalBackup([{ date: '01/15/2025' }]);
      }).not.toThrow();
      
      setItemSpy.mockRestore();
    });

    it('should handle rows with only some fields filled', () => {
      const data: TimesheetRow[] = [
        { date: '01/15/2025' },
        { project: 'Test' },
        { taskDescription: 'Task' }
      ];
      
      saveLocalBackup(data);
      
      const stored = mockLocalStorage['sheetpilot_timesheet_backup'];
      const parsed = JSON.parse(stored);
      
      expect(parsed.data).toHaveLength(3); // All have at least one field
    });
  });

  describe('batchSaveToDatabase', () => {
    it('should save complete rows to database', async () => {
      const data: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Test',
          taskDescription: 'Task'
        }
      ];
      
      await batchSaveToDatabase(data);
      
      expect(mockWindow.timesheet.saveDraft).toHaveBeenCalledTimes(1);
      expect(mockWindow.timesheet.saveDraft).toHaveBeenCalledWith({
        date: '01/15/2025',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test',
        tool: null,
        chargeCode: null,
        taskDescription: 'Task'
      });
    });

    it('should skip incomplete rows', async () => {
      const data: TimesheetRow[] = [
        { date: '01/15/2025', project: 'Test' }, // Missing timeIn, timeOut, taskDescription
        {
          date: '01/16/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Complete',
          taskDescription: 'Complete task'
        }
      ];
      
      await batchSaveToDatabase(data);
      
      expect(mockWindow.timesheet.saveDraft).toHaveBeenCalledTimes(1); // Only complete row
    });

    it('should delete orphaned rows from database', async () => {
      mockWindow.timesheet.loadDraft.mockResolvedValue({
        success: true,
        entries: [
          { id: 1, date: '01/15/2025', project: 'Test1', taskDescription: 'Task1' },
          { id: 2, date: '01/16/2025', project: 'Test2', taskDescription: 'Task2' },
          { id: 3, date: '01/17/2025', project: 'Test3', taskDescription: 'Task3' }
        ]
      });
      
      const currentData: TimesheetRow[] = [
        { id: 1, date: '01/15/2025', timeIn: '09:00', timeOut: '17:00', project: 'Test1', taskDescription: 'Task1' }
        // IDs 2 and 3 are orphaned
      ];
      
      await batchSaveToDatabase(currentData);
      
      // Should delete orphaned rows
      expect(mockWindow.timesheet.deleteDraft).toHaveBeenCalledWith(2);
      expect(mockWindow.timesheet.deleteDraft).toHaveBeenCalledWith(3);
    });

    it('should handle save errors gracefully', async () => {
      mockWindow.timesheet.saveDraft.mockResolvedValue({
        success: false,
        error: 'Database error'
      });
      
      const data: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Test',
          taskDescription: 'Task'
        }
      ];
      
      // Should not throw
      await expect(batchSaveToDatabase(data)).resolves.not.toThrow();
    });

    it('should handle API unavailable gracefully', async () => {
      (global as {window?: unknown}).window = { timesheet: undefined };
      
      const data: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Test',
          taskDescription: 'Task'
        }
      ];
      
      await expect(batchSaveToDatabase(data)).resolves.not.toThrow();
    });

    it('should handle empty data array', async () => {
      await batchSaveToDatabase([]);
      
      expect(mockWindow.timesheet.saveDraft).not.toHaveBeenCalled();
    });

    it('should convert null tool/chargeCode correctly', async () => {
      const data: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'PTO/RTO',
          tool: undefined,
          chargeCode: undefined,
          taskDescription: 'PTO'
        }
      ];
      
      await batchSaveToDatabase(data);
      
      expect(mockWindow.timesheet.saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: null,
          chargeCode: null
        })
      );
    });
  });

  describe('deleteDraftRows', () => {
    it('should delete all provided row IDs', async () => {
      const rowIds = [1, 2, 3];
      
      const deletedCount = await deleteDraftRows(rowIds);
      
      expect(deletedCount).toBe(3);
      expect(mockWindow.timesheet.deleteDraft).toHaveBeenCalledWith(1);
      expect(mockWindow.timesheet.deleteDraft).toHaveBeenCalledWith(2);
      expect(mockWindow.timesheet.deleteDraft).toHaveBeenCalledWith(3);
    });

    it('should handle deletion failures', async () => {
      mockWindow.timesheet.deleteDraft.mockResolvedValueOnce({ success: false, error: 'Not found' })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });
      
      const deletedCount = await deleteDraftRows([1, 2, 3]);
      
      expect(deletedCount).toBe(2); // Only 2 succeeded
    });

    it('should handle empty array', async () => {
      const deletedCount = await deleteDraftRows([]);
      
      expect(deletedCount).toBe(0);
      expect(mockWindow.timesheet.deleteDraft).not.toHaveBeenCalled();
    });

    it('should handle API unavailable', async () => {
      (global as {window?: unknown}).window = { timesheet: { deleteDraft: undefined } };
      
      const deletedCount = await deleteDraftRows([1, 2]);
      
      expect(deletedCount).toBe(0);
    });

    it('should handle exceptions during deletion', async () => {
      mockWindow.timesheet.deleteDraft.mockRejectedValue(new Error('Network error'));
      
      const deletedCount = await deleteDraftRows([1, 2]);
      
      expect(deletedCount).toBe(0); // All failed
    });
  });

  describe('Error Handling', () => {
    it('should log errors during save', async () => {
      mockWindow.timesheet.saveDraft.mockRejectedValue(new Error('Save failed'));
      
      const data: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Test',
          taskDescription: 'Task'
        }
      ];
      
      await batchSaveToDatabase(data);
      
      expect(mockWindow.logger.error).toHaveBeenCalled();
    });

    it('should continue processing after individual save failure', async () => {
      mockWindow.timesheet.saveDraft
        .mockResolvedValueOnce({ success: false, error: 'Error 1' })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });
      
      const data: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Test1',
          taskDescription: 'Task1'
        },
        {
          date: '01/16/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Test2',
          taskDescription: 'Task2'
        },
        {
          date: '01/17/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Test3',
          taskDescription: 'Task3'
        }
      ];
      
      await batchSaveToDatabase(data);
      
      expect(mockWindow.timesheet.saveDraft).toHaveBeenCalledTimes(3); // All attempted
    });
  });

  describe('Concurrent Save Operations', () => {
    it('should handle overlapping batch saves', async () => {
      const data: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Test',
          taskDescription: 'Task'
        }
      ];
      
      // Start two batch saves simultaneously
      const promise1 = batchSaveToDatabase(data);
      const promise2 = batchSaveToDatabase(data);
      
      await Promise.all([promise1, promise2]);
      
      // Both should complete without error
      expect(mockWindow.timesheet.saveDraft).toHaveBeenCalled();
    });
  });
});

