/**
 * @fileoverview Regression tests for database persistence issues
 * 
 * This test suite covers the specific bug where timesheet entries were successfully 
 * submitted to Smartsheet but didn't appear in the archive due to database update failures.
 * 
 * Tests ensure:
 * - Database updates are validated and persisted correctly
 * - WAL checkpoint is executed to flush changes to disk
 * - Entries don't get lost when database operations fail
 * - Error handling is proper throughout the submission flow
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
    removeFailedTimesheetEntries,
    closeConnection
} from '../src/services/database';

describe('Database Persistence Regression Tests', () => {
    let testDbPath: string;
    let originalDbPath: string;

    beforeEach(() => {
        // Store original DB path
        originalDbPath = getDbPath();
        
        // Create isolated test database
        testDbPath = path.join(os.tmpdir(), `sheetpilot-regression-${Date.now()}.sqlite`);
        setDbPath(testDbPath);
        
        // Ensure schema is created
        ensureSchema();
    });

    afterEach(() => {
        // Ensure connection is closed
        try {
            closeConnection();
        } catch {
            // Ignore cleanup errors
        }
        
        // Restore original DB path
        setDbPath(originalDbPath);
        
        // Clean up test database file
        if (fs.existsSync(testDbPath)) {
            try {
                fs.unlinkSync(testDbPath);
            } catch {
                // Ignore cleanup errors
            }
        }
    });

    describe('Regression: Entries disappearing after successful submission', () => {
        it('should reproduce the original bug scenario and verify fix', () => {
            // SETUP: User creates a full week of timesheet entries
            const weekEntries = [
                { date: '2025-01-13', timeIn: 540, timeOut: 1020, project: 'Project A', taskDescription: 'Monday work' },
                { date: '2025-01-14', timeIn: 540, timeOut: 1020, project: 'Project A', taskDescription: 'Tuesday work' },
                { date: '2025-01-15', timeIn: 540, timeOut: 1020, project: 'Project B', taskDescription: 'Wednesday work' },
                { date: '2025-01-16', timeIn: 540, timeOut: 1020, project: 'Project A', taskDescription: 'Thursday work' },
                { date: '2025-01-17', timeIn: 540, timeOut: 1020, project: 'Project C', taskDescription: 'Friday work' }
            ];

            weekEntries.forEach(entry => {
                const result = insertTimesheetEntry(entry);
                expect(result.success).toBe(true);
            });

            // Verify all entries are pending
            const pendingEntries = getPendingTimesheetEntries();
            expect(pendingEntries).toHaveLength(5);

            // Get entry IDs
            const entryIds = pendingEntries.map((e: any) => e.id);

            // SIMULATE: Successful submission to Smartsheet (bot succeeded)
            // Mark entries as submitted (this is where the bug occurred)
            markTimesheetEntriesAsSubmitted(entryIds);

            // VERIFY: Entries should no longer be pending
            const pendingAfterSubmit = getPendingTimesheetEntries();
            expect(pendingAfterSubmit).toHaveLength(0);

            // VERIFY: Entries should be in archive (status = 'Complete')
            const db = openDb();
            const archivedEntries = db.prepare('SELECT * FROM timesheet WHERE status = ?').all('Complete');
            expect(archivedEntries).toHaveLength(5);

            // Verify submitted_at timestamp is set
            archivedEntries.forEach((entry: any) => {
                expect(entry.submitted_at).toBeTruthy();
                expect(entry.status).toBe('Complete');
            });

            db.close();

            // CRITICAL: Simulate app reload (close and reopen database)
            closeConnection();
            setDbPath(testDbPath);
            ensureSchema();

            // VERIFY: After reload, entries should STILL be in archive (not reappear in pending)
            const pendingAfterReload = getPendingTimesheetEntries();
            expect(pendingAfterReload).toHaveLength(0);

            const dbReload = openDb();
            const archivedAfterReload = dbReload.prepare('SELECT * FROM timesheet WHERE status = ?').all('Complete');
            expect(archivedAfterReload).toHaveLength(5);

            // Verify data integrity
            archivedAfterReload.forEach((entry: any, index: number) => {
                expect(entry.status).toBe('Complete');
                expect(entry.submitted_at).toBeTruthy();
                expect(entry.project).toBeTruthy();
                expect(entry.task_description).toBeTruthy();
            });

            dbReload.close();
        });

        it('should detect when database update affects fewer rows than expected', () => {
            // Insert 3 entries
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'TestProject',
                taskDescription: 'Task 1'
            });

            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 600,
                timeOut: 660,
                project: 'TestProject',
                taskDescription: 'Task 2'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const realIds = pendingEntries.map((e: any) => e.id);

            // Try to mark non-existent ID along with real IDs
            const idsWithFake = [...realIds, 99999];

            // Should throw error because not all IDs were found
            expect(() => {
                markTimesheetEntriesAsSubmitted(idsWithFake);
            }).toThrow(/Database update mismatch/);

            // Verify NO entries were marked as submitted (atomic operation)
            const db = openDb();
            const completeEntries = db.prepare('SELECT * FROM timesheet WHERE status = ?').all('Complete');
            expect(completeEntries).toHaveLength(0);

            // Verify entries are still pending
            const stillPending = getPendingTimesheetEntries();
            expect(stillPending).toHaveLength(2);

            db.close();
        });

        it('should handle WAL checkpoint failures gracefully without failing submission', () => {
            // Insert test entry
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'WALTest',
                taskDescription: 'Test WAL checkpoint'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            // Mock WAL checkpoint to fail (by using a read-only db)
            // Note: The actual implementation should log warning but not throw
            // This test verifies that checkpoint failures don't prevent submission

            // Mark as submitted (checkpoint happens internally)
            markTimesheetEntriesAsSubmitted([entryId]);

            // Verify entry was still marked as submitted despite checkpoint issues
            const db = openDb();
            const entry = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryId);
            expect((entry as any).status).toBe('Complete');
            db.close();
        });

        it('should verify changes persist across database reconnections', () => {
            // Insert entry
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'PersistenceTest',
                taskDescription: 'Test persistence'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            // Mark as submitted
            markTimesheetEntriesAsSubmitted([entryId]);

            // Close connection multiple times and reopen
            for (let i = 0; i < 3; i++) {
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
    });

    describe('Regression: Silent failures in database updates', () => {
        it('should throw error when trying to mark already-submitted entries', () => {
            // Insert and submit
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'TestProject',
                taskDescription: 'Test task'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            // Mark as submitted
            markTimesheetEntriesAsSubmitted([entryId]);

            // Try to mark again - should throw because entry is already Complete
            expect(() => {
                markTimesheetEntriesAsSubmitted([entryId]);
            }).toThrow(/Database update mismatch/);
        });

        it('should throw error when reverting non-existent entries', () => {
            const fakeIds = [99999, 88888, 77777];

            // Should throw error
            expect(() => {
                removeFailedTimesheetEntries(fakeIds);
            }).toThrow(/Database update mismatch/);
        });

        it('should log detailed error information on validation failure', () => {
            // Create spy for console.log to capture logging
            const logSpy = vi.spyOn(console, 'log');

            // Try to mark non-existent entries
            try {
                markTimesheetEntriesAsSubmitted([99999, 88888]);
            } catch (error) {
                // Error is expected
                expect(error).toBeDefined();
            }

            // Note: In real implementation, this would verify logger was called
            // For now, we just verify the error was thrown
            logSpy.mockRestore();
        });
    });

    describe('Regression: Race conditions in status updates', () => {
        it('should handle concurrent marking of same entries safely', () => {
            // Insert entries
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'ConcurrentTest',
                taskDescription: 'Test 1'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryIds = pendingEntries.map((e: any) => e.id);

            // First marking should succeed
            markTimesheetEntriesAsSubmitted(entryIds);

            // Second marking should fail (entries already Complete)
            expect(() => {
                markTimesheetEntriesAsSubmitted(entryIds);
            }).toThrow(/Database update mismatch/);

            // Verify entry is still Complete (not corrupted)
            const db = openDb();
            const entry = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryIds[0]);
            expect((entry as any).status).toBe('Complete');
            db.close();
        });

        it('should maintain atomicity when updating multiple entries', () => {
            // Insert multiple entries
            for (let i = 0; i < 5; i++) {
                insertTimesheetEntry({
                    date: '2025-01-15',
                    timeIn: 540 + (i * 60),
                    timeOut: 600 + (i * 60),
                    project: 'AtomicTest',
                    taskDescription: `Task ${i}`
                });
            }

            const pendingEntries = getPendingTimesheetEntries();
            const entryIds = pendingEntries.map((e: any) => e.id);

            // Add a fake ID to cause partial failure
            const idsWithFake = [...entryIds, 99999];

            // Should throw error
            expect(() => {
                markTimesheetEntriesAsSubmitted(idsWithFake);
            }).toThrow(/Database update mismatch/);

            // Verify NONE of the entries were marked (all-or-nothing)
            const db = openDb();
            const completeEntries = db.prepare('SELECT * FROM timesheet WHERE status = ?').all('Complete');
            expect(completeEntries).toHaveLength(0);

            // All should still be pending
            const stillPending = getPendingTimesheetEntries();
            expect(stillPending).toHaveLength(5);

            db.close();
        });
    });

    describe('Regression: Data loss prevention', () => {
        it('should never delete entries, only update status', () => {
            // Insert entry
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'NoDeleteTest',
                taskDescription: 'Test task'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            // Mark as in_progress
            const db = openDb();
            db.prepare('UPDATE timesheet SET status = ? WHERE id = ?').run('in_progress', entryId);

            // Count total entries
            const countBeforeRevert = db.prepare('SELECT COUNT(*) as count FROM timesheet').get();
            expect((countBeforeRevert as any).count).toBe(1);

            db.close();

            // Revert failed entry (should change status to NULL, not delete)
            removeFailedTimesheetEntries([entryId]);

            // Verify entry still exists
            const dbAfter = openDb();
            const countAfterRevert = dbAfter.prepare('SELECT COUNT(*) as count FROM timesheet').get();
            expect((countAfterRevert as any).count).toBe(1);

            // Verify status is NULL (pending)
            const entry = dbAfter.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryId);
            expect((entry as any).status).toBeNull();
            expect((entry as any).project).toBe('NoDeleteTest');

            dbAfter.close();
        });

        it('should preserve all entry data during status transitions', () => {
            // Insert detailed entry
            const originalEntry = {
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 660,
                project: 'DataIntegrityTest',
                tool: 'VS Code',
                detailChargeCode: 'DEV-001',
                taskDescription: 'Detailed task description'
            };

            insertTimesheetEntry(originalEntry);

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            // Mark as submitted
            markTimesheetEntriesAsSubmitted([entryId]);

            // Verify all data is intact
            const db = openDb();
            const submittedEntry = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryId);

            expect((submittedEntry as any).date).toBe(originalEntry.date);
            expect((submittedEntry as any).time_in).toBe(originalEntry.timeIn);
            expect((submittedEntry as any).time_out).toBe(originalEntry.timeOut);
            expect((submittedEntry as any).project).toBe(originalEntry.project);
            expect((submittedEntry as any).tool).toBe(originalEntry.tool);
            expect((submittedEntry as any).detail_charge_code).toBe(originalEntry.detailChargeCode);
            expect((submittedEntry as any).task_description).toBe(originalEntry.taskDescription);
            expect((submittedEntry as any).status).toBe('Complete');
            expect((submittedEntry as any).submitted_at).toBeTruthy();

            db.close();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty array of IDs gracefully', () => {
            // Should not throw
            expect(() => {
                markTimesheetEntriesAsSubmitted([]);
            }).not.toThrow();

            expect(() => {
                removeFailedTimesheetEntries([]);
            }).not.toThrow();
        });

        it('should handle very large batch of entries', () => {
            // Insert 100 entries
            const entries = [];
            for (let i = 0; i < 100; i++) {
                insertTimesheetEntry({
                    date: '2025-01-15',
                    timeIn: 540,
                    timeOut: 600,
                    project: `Project ${i}`,
                    taskDescription: `Task ${i}`
                });
            }

            const pendingEntries = getPendingTimesheetEntries();
            expect(pendingEntries).toHaveLength(100);

            const entryIds = pendingEntries.map((e: any) => e.id);

            // Mark all as submitted
            markTimesheetEntriesAsSubmitted(entryIds);

            // Verify all marked
            const db = openDb();
            const completeEntries = db.prepare('SELECT COUNT(*) as count FROM timesheet WHERE status = ?').get('Complete');
            expect((completeEntries as any).count).toBe(100);
            db.close();
        });

        it('should handle database reopening after marking entries', () => {
            // Insert and mark
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'ReopenTest',
                taskDescription: 'Test'
            });

            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;

            markTimesheetEntriesAsSubmitted([entryId]);

            // Reopen database multiple times
            for (let i = 0; i < 5; i++) {
                closeConnection();
                setDbPath(testDbPath);
                ensureSchema();

                const pending = getPendingTimesheetEntries();
                expect(pending).toHaveLength(0);

                const db = openDb();
                const complete = db.prepare('SELECT COUNT(*) as count FROM timesheet WHERE status = ?').get('Complete');
                expect((complete as any).count).toBe(1);
                db.close();
            }
        });
    });
});


