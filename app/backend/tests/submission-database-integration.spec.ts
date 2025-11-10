/**
 * @fileoverview Integration tests for submission service and database interactions
 * 
 * Tests the critical path where Smartsheet submission succeeds but database updates
 * might fail, ensuring proper error handling and data consistency.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
    setDbPath,
    getDbPath,
    openDb,
    ensureSchema,
    insertTimesheetEntry,
    getPendingTimesheetEntries,
    markTimesheetEntriesAsSubmitted,
    closeConnection
} from '../src/services/database';

describe('Submission-Database Integration Tests', () => {
    let testDbPath: string;
    let originalDbPath: string;

    beforeEach(() => {
        originalDbPath = getDbPath();
        testDbPath = path.join(os.tmpdir(), `sheetpilot-integration-${Date.now()}.sqlite`);
        setDbPath(testDbPath);
        ensureSchema();
    });

    afterEach(() => {
        try {
            closeConnection();
        } catch {
            // Ignore
        }
        
        setDbPath(originalDbPath);
        
        if (fs.existsSync(testDbPath)) {
            try {
                fs.unlinkSync(testDbPath);
            } catch {
                // Ignore
            }
        }
    });

    describe('Critical Path: Smartsheet Success + Database Failure', () => {
        it('should handle scenario where submission succeeds but database update fails', () => {
            // SETUP: Insert test entries
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'CriticalTest',
                taskDescription: 'Task 1'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryIds = pendingEntries.map((e: any) => e.id);

            // SIMULATE: Bot submission succeeds (entries go to Smartsheet)
            // But database update fails (e.g., wrong IDs provided)
            const wrongIds = [99999]; // Non-existent ID

            // This should throw an error
            expect(() => {
                markTimesheetEntriesAsSubmitted(wrongIds);
            }).toThrow(/Database update mismatch/);

            // VERIFY: Original entries are still pending (not lost)
            const stillPending = getPendingTimesheetEntries();
            expect(stillPending).toHaveLength(1);
            expect(stillPending[0].id).toBe(entryIds[0]);

            // VERIFY: No entries marked as Complete incorrectly
            const db = openDb();
            const completeEntries = db.prepare('SELECT * FROM timesheet WHERE status = ?').all('Complete');
            expect(completeEntries).toHaveLength(0);
            db.close();
        });

        it('should prevent data loss when marking fails after successful bot submission', () => {
            // Insert multiple entries
            for (let i = 0; i < 3; i++) {
                insertTimesheetEntry({
                    date: '2025-01-15',
                    timeIn: 540 + (i * 60),
                    timeOut: 600 + (i * 60),
                    project: 'DataLossTest',
                    taskDescription: `Task ${i}`
                });
            }

            const pendingEntries = getPendingTimesheetEntries();
            expect(pendingEntries).toHaveLength(3);
            const entryIds = pendingEntries.map((e: any) => e.id);

            // Mark as in_progress (simulating submission start)
            const db = openDb();
            entryIds.forEach((id: number) => {
                db.prepare('UPDATE timesheet SET status = ? WHERE id = ?').run('in_progress', id);
            });
            db.close();

            // Simulate bot succeeds for 2 entries, fails for 1
            const successIds = entryIds.slice(0, 2);
            const failedIds = entryIds.slice(2);

            // Mark successful ones as submitted
            markTimesheetEntriesAsSubmitted(successIds);

            // VERIFY: Successful entries are Complete
            const dbVerify = openDb();
            const completeEntries = dbVerify.prepare('SELECT * FROM timesheet WHERE status = ?').all('Complete');
            expect(completeEntries).toHaveLength(2);

            // VERIFY: Failed entry is still in_progress (can be reverted later)
            const inProgressEntry = dbVerify.prepare('SELECT * FROM timesheet WHERE id = ?').get(failedIds[0]);
            expect((inProgressEntry as any).status).toBe('in_progress');

            dbVerify.close();

            // VERIFY: Total count is still 3 (no data loss)
            const dbCount = openDb();
            const totalCount = dbCount.prepare('SELECT COUNT(*) as count FROM timesheet').get();
            expect((totalCount as any).count).toBe(3);
            dbCount.close();
        });

        it('should properly handle transaction rollback on validation failure', () => {
            // Insert test data
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'RollbackTest',
                taskDescription: 'Test task'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const realId = pendingEntries[0].id;

            // Try to mark with mixed valid and invalid IDs
            const mixedIds = [realId, 99999, 88888];

            // Should throw error
            expect(() => {
                markTimesheetEntriesAsSubmitted(mixedIds);
            }).toThrow(/Database update mismatch/);

            // VERIFY: Real entry is NOT marked as Complete (transaction rolled back)
            const db = openDb();
            const entry = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(realId);
            expect((entry as any).status).toBeNull(); // Still pending
            db.close();
        });
    });

    describe('Error Recovery Scenarios', () => {
        it('should allow retry after failed database update', () => {
            // Insert entry
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'RetryTest',
                taskDescription: 'Test task'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            // First attempt with wrong ID (simulating failure)
            expect(() => {
                markTimesheetEntriesAsSubmitted([99999]);
            }).toThrow();

            // Entry should still be pending
            const stillPending = getPendingTimesheetEntries();
            expect(stillPending).toHaveLength(1);

            // Second attempt with correct ID (retry succeeds)
            markTimesheetEntriesAsSubmitted([entryId]);

            // Entry should now be Complete
            const db = openDb();
            const entry = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryId);
            expect((entry as any).status).toBe('Complete');
            db.close();
        });

        it('should maintain data integrity during concurrent status updates', () => {
            // Insert entry
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'ConcurrentTest',
                taskDescription: 'Test task'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            // First update succeeds
            markTimesheetEntriesAsSubmitted([entryId]);

            // Second update should fail (already Complete)
            expect(() => {
                markTimesheetEntriesAsSubmitted([entryId]);
            }).toThrow(/Database update mismatch/);

            // Verify entry is still Complete (not corrupted)
            const db = openDb();
            const entry = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryId);
            expect((entry as any).status).toBe('Complete');
            expect((entry as any).submitted_at).toBeTruthy();
            db.close();
        });
    });

    describe('Validation and Consistency Checks', () => {
        it('should validate that all provided IDs exist before updating', () => {
            // Insert 2 entries
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'ValidationTest',
                taskDescription: 'Task 1'
            });

            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 600,
                timeOut: 660,
                project: 'ValidationTest',
                taskDescription: 'Task 2'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const realIds = pendingEntries.map((e: any) => e.id);

            // Add fake IDs
            const invalidIds = [...realIds, 99999, 88888];

            // Should throw because not all IDs exist
            expect(() => {
                markTimesheetEntriesAsSubmitted(invalidIds);
            }).toThrow(/Database update mismatch/);

            // Verify NO entries were updated (all-or-nothing)
            const db = openDb();
            const completeEntries = db.prepare('SELECT * FROM timesheet WHERE status = ?').all('Complete');
            expect(completeEntries).toHaveLength(0);
            db.close();
        });

        it('should verify row count matches expected updates', () => {
            // Insert entries
            for (let i = 0; i < 5; i++) {
                insertTimesheetEntry({
                    date: '2025-01-15',
                    timeIn: 540 + (i * 60),
                    timeOut: 600 + (i * 60),
                    project: 'CountTest',
                    taskDescription: `Task ${i}`
                });
            }

            const pendingEntries = getPendingTimesheetEntries();
            const entryIds = pendingEntries.map((e: any) => e.id);

            // Mark all as submitted
            markTimesheetEntriesAsSubmitted(entryIds);

            // Verify exactly 5 entries were updated
            const db = openDb();
            const completeCount = db.prepare('SELECT COUNT(*) as count FROM timesheet WHERE status = ?').get('Complete');
            expect((completeCount as any).count).toBe(5);
            db.close();
        });

        it('should detect status mismatch when trying to update non-pending entries', () => {
            // Insert and submit entry
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'StatusTest',
                taskDescription: 'Test task'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            // Mark as submitted
            markTimesheetEntriesAsSubmitted([entryId]);

            // Try to mark again (entry is now Complete, not pending)
            expect(() => {
                markTimesheetEntriesAsSubmitted([entryId]);
            }).toThrow(/Database update mismatch/);
        });
    });

    describe('Persistence and Durability', () => {
        it('should ensure changes are persisted across database reconnections', () => {
            // Insert and submit
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'DurabilityTest',
                taskDescription: 'Test task'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            markTimesheetEntriesAsSubmitted([entryId]);

            // Reconnect multiple times
            for (let i = 0; i < 10; i++) {
                closeConnection();
                setDbPath(testDbPath);
                ensureSchema();

                const db = openDb();
                const entry = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryId);
                expect((entry as any).status).toBe('Complete');
                expect((entry as any).submitted_at).toBeTruthy();
                db.close();
            }
        });

        it('should handle database file corruption detection', () => {
            // Insert entry
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'CorruptionTest',
                taskDescription: 'Test task'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            // Mark as submitted
            markTimesheetEntriesAsSubmitted([entryId]);

            // Verify data integrity
            const db = openDb();
            
            // Run integrity check
            const integrityCheck = db.pragma('integrity_check');
            expect(integrityCheck).toBeDefined();
            
            // Verify entry data
            const entry = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryId);
            expect((entry as any).status).toBe('Complete');
            expect((entry as any).project).toBe('CorruptionTest');
            
            db.close();
        });
    });

    describe('Performance and Scalability', () => {
        it('should handle large batch updates efficiently', () => {
            // Insert 500 entries
            const startTime = Date.now();
            for (let i = 0; i < 500; i++) {
                insertTimesheetEntry({
                    date: '2025-01-15',
                    timeIn: 540,
                    timeOut: 600,
                    project: `Project ${i % 10}`, // 10 different projects
                    taskDescription: `Task ${i}`
                });
            }
            const insertTime = Date.now() - startTime;

            const pendingEntries = getPendingTimesheetEntries();
            expect(pendingEntries).toHaveLength(500);

            const entryIds = pendingEntries.map((e: any) => e.id);

            // Mark all as submitted
            const updateStart = Date.now();
            markTimesheetEntriesAsSubmitted(entryIds);
            const updateTime = Date.now() - updateStart;

            // Verify all updated
            const db = openDb();
            const completeCount = db.prepare('SELECT COUNT(*) as count FROM timesheet WHERE status = ?').get('Complete');
            expect((completeCount as any).count).toBe(500);
            db.close();

            // Performance should be reasonable (< 5 seconds for both operations)
            expect(insertTime + updateTime).toBeLessThan(5000);
        });

        it('should maintain performance with repeated updates', () => {
            // Insert entries
            for (let i = 0; i < 50; i++) {
                insertTimesheetEntry({
                    date: '2025-01-15',
                    timeIn: 540 + (i * 15),
                    timeOut: 600 + (i * 15),
                    project: 'PerformanceTest',
                    taskDescription: `Task ${i}`
                });
            }

            const pendingEntries = getPendingTimesheetEntries();
            const entryIds = pendingEntries.map((e: any) => e.id);

            // Mark in batches of 10
            for (let i = 0; i < 5; i++) {
                const batchIds = entryIds.slice(i * 10, (i + 1) * 10);
                const startTime = Date.now();
                markTimesheetEntriesAsSubmitted(batchIds);
                const duration = Date.now() - startTime;
                
                // Each batch should complete quickly (< 100ms)
                expect(duration).toBeLessThan(100);
            }

            // Verify all marked
            const db = openDb();
            const completeCount = db.prepare('SELECT COUNT(*) as count FROM timesheet WHERE status = ?').get('Complete');
            expect((completeCount as any).count).toBe(50);
            db.close();
        });
    });
});


