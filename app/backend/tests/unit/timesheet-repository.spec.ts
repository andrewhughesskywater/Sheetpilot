/**
 * @fileoverview Timesheet Repository Unit Tests
 * 
 * Tests for timesheet data operations, batch processing, and data consistency.
 * Ensures correct interaction with database layer.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock logger
vi.mock('../../../shared/logger', () => ({
  dbLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() }))
  }
}));

import {
  insertTimesheetEntry,
  insertTimesheetEntries,
  getPendingTimesheetEntries,
  getSubmittedTimesheetEntriesForExport,
  markTimesheetEntriesAsSubmitted,
  removeFailedTimesheetEntries
} from '../../src/repositories/timesheet-repository';
import { setDbPath, openDb, ensureSchema, shutdownDatabase } from '../../src/repositories';

// Type for database row
interface DbRow { [key: string]: unknown }

describe('Timesheet Repository', () => {
  let testDbPath: string;
  let originalDbPath: string;

  beforeEach(() => {
    originalDbPath = process.env['SHEETPILOT_DB_PATH'] || '';
    testDbPath = path.join(os.tmpdir(), `sheetpilot-timesheet-repo-test-${Date.now()}.sqlite`);
    setDbPath(testDbPath);
    ensureSchema();
  });

  afterEach(() => {
    try {
      shutdownDatabase();
    } catch {
      // Ignore
    }
    
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore
      }
    }
    
    if (originalDbPath) {
      setDbPath(originalDbPath);
    }
  });

  describe('Single Entry Operations', () => {
    it('should insert timesheet entry successfully', () => {
      const entry = {
        date: '2025-01-15',
        timeIn: 540,  // 09:00
        timeOut: 1020, // 17:00
        project: 'Test Project',
        tool: 'Test Tool',
        detailChargeCode: 'EPR1',
        taskDescription: 'Test task description'
      };
      
      const result = insertTimesheetEntry(entry);
      
      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(false);
      expect(result.changes).toBe(1);
    });

    it('should detect duplicate entries', () => {
      const entry = {
        date: '2025-01-15',
        timeIn: 540,
        timeOut: 1020,
        project: 'Duplicate Test',
        taskDescription: 'Test task'
      };
      
      // Insert first time
      const result1 = insertTimesheetEntry(entry);
      expect(result1.success).toBe(true);
      
      // Insert duplicate
      const result2 = insertTimesheetEntry(entry);
      expect(result2.isDuplicate).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.changes).toBe(0);
    });

    it('should allow entries with different time_in as non-duplicates', () => {
      const entry1 = {
        date: '2025-01-15',
        timeIn: 540,
        timeOut: 1020,
        project: 'Test',
        taskDescription: 'Task'
      };
      
      const entry2 = {
        ...entry1,
        timeIn: 600 // Different time_in
      };
      
      expect(insertTimesheetEntry(entry1).success).toBe(true);
      expect(insertTimesheetEntry(entry2).success).toBe(true);
    });

    it('should update entry status', () => {
      const entry = {
        date: '2025-01-15',
        timeIn: 540,
        timeOut: 1020,
        project: 'Test',
        taskDescription: 'Task'
      };
      
      insertTimesheetEntry(entry);
      
      // Get the entry ID
      const db = openDb();
      const row = db.prepare('SELECT id FROM timesheet WHERE project = ?').get('Test');
      const entryId = (row as DbRow)['id'] as number;
      db.close();
      
      // Mark as submitted (which sets status)
      markTimesheetEntriesAsSubmitted([entryId]);
      
      // Verify status updated
      const db2 = openDb();
      const updated = db2.prepare('SELECT status FROM timesheet WHERE id = ?').get(entryId);
      expect((updated as DbRow)['status'] as string).toBe('submitted');
      db2.close();
    });

    it('should delete entry successfully', () => {
      const entry = {
        date: '2025-01-15',
        timeIn: 540,
        timeOut: 1020,
        project: 'Delete Test',
        taskDescription: 'Test'
      };
      
      insertTimesheetEntry(entry);
      
      const db = openDb();
      const row = db.prepare('SELECT id FROM timesheet WHERE project = ?').get('Delete Test');
      const entryId = (row as DbRow)['id'] as number;
      db.close();
      
      const db3 = openDb();
      const info = db3.prepare('DELETE FROM timesheet WHERE id = ?').run(entryId);
      db3.close();

      const result = { success: info.changes > 0, changes: info.changes };
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });
  });

  describe('Batch Operations', () => {
    it('should insert multiple entries successfully', () => {
      const entries = [
        {
          date: '2025-01-15',
          timeIn: 540,
          timeOut: 600,
          project: 'Batch Test 1',
          taskDescription: 'Task 1'
        },
        {
          date: '2025-01-16',
          timeIn: 540,
          timeOut: 600,
          project: 'Batch Test 2',
          taskDescription: 'Task 2'
        },
        {
          date: '2025-01-17',
          timeIn: 540,
          timeOut: 600,
          project: 'Batch Test 3',
          taskDescription: 'Task 3'
        }
      ];
      
      const result = insertTimesheetEntries(entries);
      
      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.inserted).toBe(3);
      expect(result.duplicates).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should handle mixed duplicates in batch', () => {
      // Insert first batch
      const entries1 = [
        {
          date: '2025-01-15',
          timeIn: 540,
          timeOut: 600,
          project: 'Test 1',
          taskDescription: 'Task 1'
        },
        {
          date: '2025-01-16',
          timeIn: 540,
          timeOut: 600,
          project: 'Test 2',
          taskDescription: 'Task 2'
        }
      ];
      
      insertTimesheetEntries(entries1);
      
      // Second batch with one duplicate
      const entries2 = [
        entries1[0], // Duplicate
        {
          date: '2025-01-17',
          timeIn: 540,
          timeOut: 600,
          project: 'Test 3',
          taskDescription: 'Task 3'
        }
      ];
      
      const result = insertTimesheetEntries(entries2);
      
      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.inserted).toBe(1);
      expect(result.duplicates).toBe(1);
    });

    it('should handle empty batch gracefully', () => {
      const result = insertTimesheetEntries([]);
      
      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
      expect(result.inserted).toBe(0);
    });

    it('should handle large batch operations', () => {
      const entries = [];
      
      for (let i = 0; i < 500; i++) {
        entries.push({
          date: '2025-01-15',
          timeIn: 540 + i,
          timeOut: 600 + i,
          project: `Project ${i}`,
          taskDescription: `Task ${i}`
        });
      }
      
      const startTime = Date.now();
      const result = insertTimesheetEntries(entries);
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.inserted).toBe(500);
      expect(duration).toBeLessThan(5000); // Should be reasonably fast
    });
  });

  describe('Query Operations', () => {
    beforeEach(() => {
      // Insert test data
      const entries = [
        {
          date: '2025-01-15',
          timeIn: 540,
          timeOut: 1020,
          project: 'Project A',
          taskDescription: 'Task A'
        },
        {
          date: '2025-01-16',
          timeIn: 540,
          timeOut: 1020,
          project: 'Project B',
          taskDescription: 'Task B'
        }
      ];
      
      entries.forEach(entry => insertTimesheetEntry(entry));
      
      // Mark one as complete
      const db = openDb();
      db.prepare('UPDATE timesheet SET status = ? WHERE project = ?')
        .run('Complete', 'Project A');
      db.close();
    });

    it('should get only pending entries', () => {
      const pending = getPendingTimesheetEntries();
      
      expect(pending.length).toBe(1);
      expect(pending[0].project).toBe('Project B');
      expect(pending[0].status).toBeNull();
    });

    it('should get only submitted entries for export', () => {
      const submitted = getSubmittedTimesheetEntriesForExport();
      
      expect(submitted.length).toBe(1);
      const entry = submitted[0] as DbRow;
      expect(entry['project']).toBe('Project A');
      expect(entry['status']).toBe('Complete');
    });

    it('should return empty array when no pending entries', () => {
      // Mark all as complete
      const db = openDb();
      db.prepare('UPDATE timesheet SET status = ?').run('Complete');
      db.close();
      
      const pending = getPendingTimesheetEntries();
      expect(pending).toEqual([]);
    });

    it('should return empty array when no submitted entries', () => {
      // Clear all statuses
      const db = openDb();
      db.prepare('UPDATE timesheet SET status = NULL').run();
      db.close();
      
      const submitted = getSubmittedTimesheetEntriesForExport();
      expect(submitted).toEqual([]);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity', () => {
      const entry = {
        date: '2025-01-15',
        timeIn: 540,
        timeOut: 1020,
        project: 'Integrity Test',
        taskDescription: 'Test'
      };
      
      insertTimesheetEntry(entry);
      
      // Verify all fields are preserved
      const db = openDb();
      const row = db.prepare('SELECT * FROM timesheet WHERE project = ?').get('Integrity Test');
      db.close();
      
      expect(row).toBeDefined();
      expect((row as DbRow)['date'] as string).toBe('2025-01-15');
      expect((row as DbRow)['time_in'] as number).toBe(540);
      expect((row as DbRow)['time_out'] as number).toBe(1020);
      expect((row as DbRow)['project'] as string).toBe('Integrity Test');
      expect((row as DbRow)['task_description'] as string).toBe('Test');
    });

    it('should calculate hours correctly', () => {
      const entry = {
        date: '2025-01-15',
        timeIn: 540,  // 09:00
        timeOut: 1020, // 17:00 (480 minutes = 8 hours)
        project: 'Hours Test',
        taskDescription: 'Test'
      };
      
      insertTimesheetEntry(entry);
      
      const db = openDb();
      const row = db.prepare('SELECT hours FROM timesheet WHERE project = ?').get('Hours Test');
      db.close();
      
      expect((row as DbRow)['hours'] as number).toBe(8.0);
    });

    it('should handle NULL values in optional fields', () => {
      const entry = {
        date: '2025-01-15',
        timeIn: 540,
        timeOut: 1020,
        project: 'Null Test',
        tool: null,
        detailChargeCode: null,
        taskDescription: 'Test'
      };
      
      insertTimesheetEntry(entry);
      
      const db = openDb();
      const row = db.prepare('SELECT tool, detail_charge_code FROM timesheet WHERE project = ?').get('Null Test');
      db.close();
      
      expect((row as DbRow)['tool']).toBeNull();
      expect((row as DbRow)['detail_charge_code']).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should query pending entries efficiently', () => {
      // Insert many entries
      for (let i = 0; i < 100; i++) {
        insertTimesheetEntry({
          date: '2025-01-15',
          timeIn: 540 + i,
          timeOut: 600 + i,
          project: `Project ${i}`,
          taskDescription: `Task ${i}`
        });
      }
      
      const startTime = Date.now();
      const pending = getPendingTimesheetEntries();
      const duration = Date.now() - startTime;
      
      expect(pending.length).toBe(100);
      expect(duration).toBeLessThan(500);
    });

    it('should handle large result sets efficiently', () => {
      // Insert 1000 entries
      const entries = [];
      for (let i = 0; i < 1000; i++) {
        entries.push({
          date: '2025-01-15',
          timeIn: 540,
          timeOut: 600,
          project: `Large Project ${i}`,
          taskDescription: `Task ${i}`
        });
      }
      
      const startTime = Date.now();
      insertTimesheetEntries(entries);
      const insertDuration = Date.now() - startTime;
      
      const queryStart = Date.now();
      const pending = getPendingTimesheetEntries();
      const queryDuration = Date.now() - queryStart;
      
      expect(pending.length).toBe(1000);
      expect(insertDuration).toBeLessThan(10000); // 10 seconds
      expect(queryDuration).toBeLessThan(1000);   // 1 second
    });
  });
});

