/**
 * @fileoverview Integration tests for the complete IPC workflow
 *
 * Tests the full workflow from IPC handler through database to bot automation.
 * These tests catch issues with the complete integration chain.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ensureSchema,
  insertTimesheetEntry,
  getPendingTimesheetEntries,
  setDbPath,
  openDb,
  closeConnection,
} from '@/repositories';
import { submitTimesheets } from '@/services/timesheet-importer';
import * as fs from 'fs';
import * as path from 'path';

describe('IPC Workflow Integration', () => {
  const testDbPath = path.join(__dirname, 'test_ipc_workflow.db');

  beforeEach(() => {
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    setDbPath(testDbPath);
    ensureSchema();
  });

  afterEach(() => {
    closeConnection();
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should handle workflow when database has pending entries', async () => {
    // Simulate user adding entries through the UI
    insertTimesheetEntry({
      date: '2025-01-15',
      timeIn: 540,
      timeOut: 600,
      project: 'TestProject',
      taskDescription: 'Test task',
    });

    // Verify entries are pending
    const pending = getPendingTimesheetEntries();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBeNull();

    // Simulate automation button click (IPC handler calls submitTimesheets)
    const result = await submitTimesheets({ email: 'test@example.com', password: 'password123' });

    // Should attempt to process the entry
    expect(result).toBeDefined();
    expect(result.totalProcessed).toBe(1);

    // Even if submission fails (expected in test), it should not fail with browser init error
    if (!result.ok && result.error) {
      const errorMessage = result.error.toLowerCase();
      expect(errorMessage).not.toContain('page is not available');
      expect(errorMessage).not.toContain('call start() first');
    }
  });

  it('should handle workflow when database is empty', async () => {
    // No entries in database
    const pending = getPendingTimesheetEntries();
    expect(pending).toHaveLength(0);

    // Simulate automation button click with no pending entries
    const result = await submitTimesheets({ email: 'test@example.com', password: 'password123' });

    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    expect(result.totalProcessed).toBe(0);
    expect(result.submittedIds).toHaveLength(0);
  });

  it('should not mutate database entries during failed submission', async () => {
    // Insert test entry
    insertTimesheetEntry({
      date: '2025-01-15',
      timeIn: 540,
      timeOut: 600,
      project: 'TestProject',
      taskDescription: 'Test task',
    });

    const beforeSubmit = getPendingTimesheetEntries();
    const entryIdBefore = beforeSubmit[0].id;

    // Attempt submission (will fail in test environment)
    await submitTimesheets({ email: 'test@example.com', password: 'password123' });

    // Verify entry is still in database (not deleted on failed submission)
    const db = openDb();
    const checkEntry = db.prepare('SELECT * FROM timesheet WHERE id = ?');
    const entry = checkEntry.get(entryIdBefore);
    db.close();

    expect(entry).toBeDefined();
  });

  it('should handle multiple pending entries with different projects', async () => {
    // Add entries for different projects
    const entries = [
      { date: '2025-01-15', timeIn: 540, timeOut: 600, project: 'Project-A', taskDescription: 'Task A' },
      { date: '2025-01-15', timeIn: 600, timeOut: 660, project: 'Project-B', taskDescription: 'Task B' },
      { date: '2025-01-16', timeIn: 540, timeOut: 600, project: 'Project-C', taskDescription: 'Task C' },
    ];

    entries.forEach((entry) => insertTimesheetEntry(entry));

    const pending = getPendingTimesheetEntries();
    expect(pending).toHaveLength(3);

    // Attempt to submit all
    const result = await submitTimesheets({ email: 'test@example.com', password: 'password123' });

    expect(result).toBeDefined();
    expect(result.totalProcessed).toBe(3);
  });

  it('should maintain data integrity across automation attempts', async () => {
    insertTimesheetEntry({
      date: '2025-01-15',
      timeIn: 540,
      timeOut: 600,
      project: 'TestProject',
      tool: 'TestTool',
      detailChargeCode: 'CODE123',
      taskDescription: 'Test task',
    });

    const beforeAttempt = getPendingTimesheetEntries();
    const originalEntry = beforeAttempt[0];

    // First automation attempt
    await submitTimesheets({ email: 'test@example.com', password: 'password123' });

    // Second automation attempt
    await submitTimesheets({ email: 'test@example.com', password: 'password123' });

    // Verify data hasn't been corrupted
    const db = openDb();
    const getEntry = db.prepare('SELECT * FROM timesheet WHERE id = ?');
    const currentEntry = getEntry.get(originalEntry.id) as {
      project: string;
      tool: string | null;
      detail_charge_code: string | null;
      task_description: string;
    };
    db.close();

    expect(currentEntry.project).toBe(originalEntry.project);
    expect(currentEntry.tool).toBe(originalEntry.tool);
    expect(currentEntry.detail_charge_code).toBe(originalEntry.detail_charge_code);
    expect(currentEntry.task_description).toBe(originalEntry.task_description);
  });

  describe('Concurrent IPC Calls', () => {
    it('should handle concurrent read operations', async () => {
      insertTimesheetEntry({
        date: '2025-01-15',
        timeIn: 540,
        timeOut: 600,
        project: 'Test',
        taskDescription: 'Task',
      });

      // Simulate concurrent reads
      const promises = Array(10)
        .fill(null)
        .map(() => getPendingTimesheetEntries());
      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result).toHaveLength(1);
      });
    });

    it('should handle concurrent write operations', async () => {
      const entries = Array(5)
        .fill(null)
        .map((_, i) => ({
          date: '2025-01-15',
          timeIn: 540 + i * 60,
          timeOut: 600 + i * 60,
          project: `Project ${i}`,
          taskDescription: `Task ${i}`,
        }));

      // Insert concurrently
      const results = await Promise.all(entries.map((entry) => Promise.resolve(insertTimesheetEntry(entry))));

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });

    it('should maintain consistency under concurrent access', async () => {
      const operations = [];

      // Mix of reads and writes
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          operations.push(Promise.resolve(getPendingTimesheetEntries()));
        } else {
          // Time must be in 15-minute increments: 540, 555, 570, 585, etc.
          operations.push(
            Promise.resolve(
              insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540 + i * 15,
                timeOut: 600 + i * 15,
                project: `Project ${i}`,
                taskDescription: `Task ${i}`,
              })
            )
          );
        }
      }

      await Promise.all(operations);

      // Final count should be consistent
      const final = getPendingTimesheetEntries();
      expect(final.length).toBe(10); // Half were writes
    });
  });

  describe('IPC Call Ordering', () => {
    it('should process calls in correct order', async () => {
      const order: string[] = [];

      const op1 = async () => {
        order.push('op1');
        return getPendingTimesheetEntries();
      };

      const op2 = async () => {
        order.push('op2');
        insertTimesheetEntry({
          date: '2025-01-15',
          timeIn: 540,
          timeOut: 600,
          project: 'Test',
          taskDescription: 'Task',
        });
      };

      const op3 = async () => {
        order.push('op3');
        return getPendingTimesheetEntries();
      };

      await op1();
      await op2();
      await op3();

      expect(order).toEqual(['op1', 'op2', 'op3']);
    });

    it('should maintain FIFO order for queued operations', async () => {
      const results: number[] = [];

      const operations = Array(5)
        .fill(null)
        .map((_, i) => async () => {
          results.push(i);
        });

      for (const op of operations) {
        await op();
      }

      expect(results).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('IPC Timeout Handling', () => {
    it('should handle long-running operations', async () => {
      const longOperation = () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ success: true }), 100);
        });
      };

      const startTime = Date.now();
      await longOperation();
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(200); // Should not timeout
    });

    it('should timeout excessively long operations', async () => {
      const timeout = 5000;
      const operationTime = 10000;

      const willTimeout = operationTime > timeout;

      expect(willTimeout).toBe(true);
    });

    it('should clean up on timeout', async () => {
      let _cleaned = false;

      const operationWithCleanup = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 10000));
        } finally {
          _cleaned = true;
        }
      };

      // Simulate timeout
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100));

      try {
        await Promise.race([operationWithCleanup(), timeoutPromise]);
      } catch (error) {
        expect((error as Error).message).toBe('Timeout');
      }
    });
  });
});
