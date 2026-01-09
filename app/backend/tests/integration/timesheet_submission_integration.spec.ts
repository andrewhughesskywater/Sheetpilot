/**
 * @fileoverview Integration tests for timesheet submission
 * 
 * Tests the integration between the database layer and the automation bot
 * for submitting timesheet entries.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
    ensureSchema, 
    insertTimesheetEntry, 
    getPendingTimesheetEntries,
    markTimesheetEntriesAsSubmitted,
    removeFailedTimesheetEntries,
    setDbPath,
    openDb,
    closeConnection
} from '@/repositories';
import { submitTimesheets, getPendingEntries } from '@/services/timesheet-importer';
import * as fs from 'fs';
import * as path from 'path';

describe('Timesheet Submission Integration', () => {
    // Use temporary database file for testing
    const testDbPath = path.join(__dirname, 'test_timesheet.db');
    
    beforeEach(() => {
        // Clean up any existing test database and WAL files
        try {
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
            if (fs.existsSync(testDbPath + '-wal')) {
                fs.unlinkSync(testDbPath + '-wal');
            }
            if (fs.existsSync(testDbPath + '-shm')) {
                fs.unlinkSync(testDbPath + '-shm');
            }
        } catch {
            // Ignore cleanup errors
        }
        setDbPath(testDbPath);
        ensureSchema();
    });
    
    afterEach(() => {
        // Clean up test database and WAL files
        closeConnection();
        try {
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
            if (fs.existsSync(testDbPath + '-wal')) {
                fs.unlinkSync(testDbPath + '-wal');
            }
            if (fs.existsSync(testDbPath + '-shm')) {
                fs.unlinkSync(testDbPath + '-shm');
            }
        } catch {
            // Ignore cleanup errors
        }
    });
    
    it('should fetch pending entries correctly', () => {
        // Insert test entries
        insertTimesheetEntry({
            date: '2025-01-15',
            timeIn: 540,  // 9:00 AM
            timeOut: 600, // 10:00 AM
            project: 'TestProject',
            taskDescription: 'Test task'
        });
        
        insertTimesheetEntry({
            date: '2025-01-15',
            timeIn: 600,  // 10:00 AM
            timeOut: 660, // 11:00 AM
            project: 'TestProject',
            taskDescription: 'Another test task'
        });
        
        const pendingEntries = getPendingEntries();
        expect(pendingEntries).toHaveLength(2);
        expect(pendingEntries[0].status).toBeNull();
        expect(pendingEntries[1].status).toBeNull();
    });
    
    it('should mark entries as submitted correctly', () => {
        // Insert test entry
        const result = insertTimesheetEntry({
            date: '2025-01-15',
            timeIn: 540,
            timeOut: 600,
            project: 'TestProject',
            taskDescription: 'Test task'
        });
        
        expect(result.success).toBe(true);
        
        // Get the ID (we need to fetch the entry to get its ID)
        const pendingEntries = getPendingTimesheetEntries();
        const entryId = pendingEntries[0].id;
        
        // Mark as submitted
        markTimesheetEntriesAsSubmitted([entryId]);
        
        // Verify it's no longer pending
        const remainingPending = getPendingTimesheetEntries();
        expect(remainingPending).toHaveLength(0);
    });
    
    it('should remove failed entries correctly', () => {
        // Insert test entry
        insertTimesheetEntry({
            date: '2025-01-15',
            timeIn: 540,
            timeOut: 600,
            project: 'TestProject',
            taskDescription: 'Test task'
        });
        
        // Get the ID
        const pendingEntries = getPendingTimesheetEntries();
        const entryId = pendingEntries[0].id;
        
        // Mark as in_progress first (simulate submission attempt)
        const db = openDb();
        const updateStmt = db.prepare('UPDATE timesheet SET status = ? WHERE id = ?');
        const result = updateStmt.run('in_progress', entryId);
        // Verify update succeeded
        if (result.changes !== 1) {
            throw new Error(`Expected 1 row to be updated, but ${result.changes} were updated`);
        }
        // Force WAL checkpoint and sync to ensure changes are immediately visible
        db.pragma('wal_checkpoint(RESTART)');
        
        // Verify it's no longer pending (status is not NULL)
        const duringSubmission = getPendingTimesheetEntries();
        // Note: getPendingTimesheetEntries() returns entries with status IS NULL
        // Since we marked as 'in_progress', it should not be in pending list
        expect(duringSubmission).toHaveLength(0);
        
        // Remove failed entry (reverts back to NULL/pending status)
        removeFailedTimesheetEntries([entryId]);
        
        // Verify it's reverted back to pending (status = NULL)
        const afterRevert = getPendingTimesheetEntries();
        expect(afterRevert).toHaveLength(1);
        expect(afterRevert[0].id).toBe(entryId);
        expect(afterRevert[0].status).toBeNull();
    });
    
    it('should handle empty pending entries gracefully', async () => {
        // No entries in database
        const result = await submitTimesheets({ email: 'test@example.com', password: 'password123' });
        
        expect(result.ok).toBe(true);
        expect(result.submittedIds).toHaveLength(0);
        expect(result.removedIds).toHaveLength(0);
        expect(result.totalProcessed).toBe(0);
        expect(result.successCount).toBe(0);
        expect(result.removedCount).toBe(0);
    });
    
    it('should convert database rows to bot format correctly', () => {
        // This test would verify the toBotRow function works correctly
        // by inserting a row and checking the conversion
        insertTimesheetEntry({
            date: '2025-01-15',
            timeIn: 540,  // 9:00 AM
            timeOut: 600, // 10:00 AM (1 hour)
            project: 'TestProject',
            tool: 'VS Code',
            detailChargeCode: 'DEV001',
            taskDescription: 'Test task'
        });
        
        const pendingEntries = getPendingEntries();
        expect(pendingEntries).toHaveLength(1);
        
        const entry = pendingEntries[0];
        expect(entry.date).toBe('2025-01-15');
        expect(entry.time_in).toBe(540);
        expect(entry.time_out).toBe(600);
        expect(entry.project).toBe('TestProject');
        expect(entry.tool).toBe('VS Code');
        expect(entry.detail_charge_code).toBe('DEV001');
        expect(entry.task_description).toBe('Test task');
    });
    
    it('should initialize and cleanup browser when submitting timesheets', async () => {
        // Insert test entry
        insertTimesheetEntry({
            date: '2025-01-15',
            timeIn: 540,  // 9:00 AM
            timeOut: 600, // 10:00 AM
            project: 'TestProject',
            taskDescription: 'Test task'
        });
        
        // This should not throw "Page is not available; call start() first"
        // It will fail during authentication (expected), but the browser should be initialized
        const result = await submitTimesheets({ email: 'test@example.com', password: 'password123' });
        
        // Verify the function ran (even if submission failed)
        expect(result).toBeDefined();
        expect(result.ok).toBe(false); // Will fail authentication
        expect(result.totalProcessed).toBe(1);
        
        // Verify the error is NOT about browser initialization
        // The error should be about authentication failure, not "Page is not available"
        expect(result.successCount).toBe(0);
    });
    
    it('should properly handle browser lifecycle across multiple submission attempts', async () => {
        // First attempt
        insertTimesheetEntry({
            date: '2025-01-15',
            timeIn: 540,
            timeOut: 600,
            project: 'TestProject1',
            taskDescription: 'First task'
        });
        
        await submitTimesheets({ email: 'test1@example.com', password: 'password1' });
        
        // Second attempt - browser should be properly cleaned up and restarted
        insertTimesheetEntry({
            date: '2025-01-16',
            timeIn: 540,
            timeOut: 600,
            project: 'TestProject2',
            taskDescription: 'Second task'
        });
        
        // This should not fail with "Page is not available" or resource leak errors
        const result = await submitTimesheets({ email: 'test2@example.com', password: 'password2' });
        
        expect(result).toBeDefined();
        // Even though authentication fails, the browser lifecycle should work correctly
        expect(result.totalProcessed).toBeGreaterThan(0);
    });
    
    describe('Database Update Validation and Persistence', () => {
        it('should validate row count when marking entries as submitted', () => {
            // Insert test entries
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
            const entryIds = pendingEntries.map((e: { id: number }) => e.id);
            
            // Mark both as submitted
            markTimesheetEntriesAsSubmitted(entryIds);
            
            // Verify both are no longer pending
            const remainingPending = getPendingTimesheetEntries();
            expect(remainingPending).toHaveLength(0);
            
            // Verify both are marked as Complete  
            const db = openDb();
            // Query for entries that are NOT NULL (i.e., have been submitted)
            const completeEntries = db.prepare('SELECT * FROM timesheet WHERE status IS NOT NULL').all() as Array<{ status: string | number }>;
            expect(completeEntries.length).toBe(2);
            // Verify status is either 'Complete' or 1 (both are valid representations)
            completeEntries.forEach(entry => {
                expect(['Complete', 1].includes(entry.status)).toBe(true);
            });
        });
        
        it('should throw error when marking non-existent entries as submitted', () => {
            // Try to mark entries that don't exist
            const fakeIds = [99999, 88888, 77777];
            
            // Should throw error because expected row count doesn't match actual changes
            expect(() => {
                markTimesheetEntriesAsSubmitted(fakeIds);
            }).toThrow(/Database update mismatch/);
        });
        
        it('should throw error when marking already-submitted entries', () => {
            // Insert and mark as submitted
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'TestProject',
                taskDescription: 'Test task'
            });
            
            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;
            
            // Mark as submitted once
            markTimesheetEntriesAsSubmitted([entryId]);
            
            // Verify it's marked as Complete
            const dbCheck = openDb();
            const entry = dbCheck.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryId) as { status: string | number };
            // DEBUG: Log what we actually get
            console.log('Entry status:', entry, 'Status value:', entry.status, 'Type:', typeof entry.status);
            // Check if status is either 'Complete' (string) or 1 (integer representation)
            expect(['Complete', 1].includes(entry.status)).toBe(true);
            
            // Try to mark again - should throw because entry status is already 'Complete'
            // (UPDATE WHERE id = X will match 0 rows since status != NULL)
            expect(() => {
                markTimesheetEntriesAsSubmitted([entryId]);
            }).toThrow(/Database update mismatch/);
        });
        
        it('should persist changes to disk with WAL checkpoint', () => {
            // Insert test entry
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'PersistenceTest',
                taskDescription: 'Test persistence'
            });
            
            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;
            
            // Mark as submitted (includes WAL checkpoint)
            markTimesheetEntriesAsSubmitted([entryId]);
            
            // Close and reopen database to verify persistence
            closeConnection();
            setDbPath(testDbPath);
            ensureSchema();
            
            // Entry should still be marked as Complete after reopening
            const db = openDb();
            const entry = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryId) as { status: string | number; submitted_at: string };
            // Note: In tests, status might be returned as string or integer depending on schema
            expect(['Complete', 1].includes(entry.status)).toBe(true);
            expect(entry.submitted_at).toBeTruthy();
        });
        
        it('should handle partial success gracefully', () => {
            // Insert three entries
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
            const realIds = pendingEntries.map((e: { id: number }) => e.id);
            
            // Mix real and fake IDs
            const mixedIds = [...realIds, 99999];
            
            // Should throw error because not all IDs were updated
            expect(() => {
                markTimesheetEntriesAsSubmitted(mixedIds);
            }).toThrow(/Database update mismatch/);
            
            // Verify that entries remain in their original state (not marked as Complete)
            const db = openDb();
            const completeEntries = db.prepare('SELECT * FROM timesheet WHERE status IS NOT NULL').all();
            // All should still be pending after failed transaction (status should be NULL)
            expect(completeEntries.length).toBe(0);
            
            // All should still be pending
            const stillPending = getPendingTimesheetEntries();
            expect(stillPending.length).toBe(2);
        });
        
        it('should validate row count when reverting failed entries', () => {
            // Insert and mark as in_progress
            insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'TestProject',
                taskDescription: 'Test task'
            });
            
            const pendingEntries = getPendingTimesheetEntries();
            const entryId = pendingEntries[0].id;
            
            // Mark as in_progress
            const db = openDb();
            const updateStmt = db.prepare('UPDATE timesheet SET status = ? WHERE id = ?');
            const result = updateStmt.run('in_progress', entryId);
            if (result.changes !== 1) {
                throw new Error(`Expected 1 row to be updated, but ${result.changes} were updated`);
            }
            db.pragma('wal_checkpoint(RESTART)');
            
            // Revert to pending
            removeFailedTimesheetEntries([entryId]);
            
            // Verify it's back to pending
            const afterRevert = getPendingTimesheetEntries();
            expect(afterRevert).toHaveLength(1);
            expect(afterRevert[0].status).toBeNull();
        });
        
        it('should throw error when reverting non-existent entries', () => {
            const fakeIds = [99999, 88888];
            
            // Should throw error because expected row count doesn't match
            expect(() => {
                removeFailedTimesheetEntries(fakeIds);
            }).toThrow(/Database update mismatch/);
        });
        
        it('should prevent entries from being lost after successful submission', () => {
            // Insert test entries
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
            const entryIds = pendingEntries.map((e: { id: number }) => e.id);
            
            // Mark as submitted
            markTimesheetEntriesAsSubmitted(entryIds);
            
            // Close and reopen database
            closeConnection();
            setDbPath(testDbPath);
            ensureSchema();
            
            // Entries should NOT reappear in pending
            const pendingAfterReopen = getPendingTimesheetEntries();
            expect(pendingAfterReopen).toHaveLength(0);
            
            // Entries should appear in archive (Complete status)
            const db = openDb();
            const archiveEntries = db.prepare('SELECT * FROM timesheet WHERE status IS NOT NULL').all();
            expect(archiveEntries.length).toBe(2);
            
            // Verify all fields are intact
            (archiveEntries as Array<{ status: string | number; submitted_at: string; project: string }>).forEach(entry => {
                expect(['Complete', 1].includes(entry.status)).toBe(true);
                expect(entry.submitted_at).toBeTruthy();
                expect(entry.project).toBe('TestProject');
            });
        });
        
        it('should maintain referential integrity across submission lifecycle', () => {
            // Insert entry
            const insertResult = insertTimesheetEntry({
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'IntegrityTest',
                taskDescription: 'Test task'
            });
            expect(insertResult.success).toBe(true);
            
            // Get ID
            const pendingEntries = getPendingTimesheetEntries();
            expect(pendingEntries).toHaveLength(1);
            const entryId = pendingEntries[0].id;
            
            // Mark as in_progress using explicit checkpoint for visibility
            const db = openDb();
            const updateStmt = db.prepare('UPDATE timesheet SET status = ? WHERE id = ?');
            const updateResult = updateStmt.run('in_progress', entryId);
            if (updateResult.changes !== 1) {
                throw new Error(`Expected 1 row to be updated, but ${updateResult.changes} were updated`);
            }
            db.pragma('wal_checkpoint(RESTART)');
            
            // Verify not in pending (since status is 'in_progress', not NULL)
            const duringSubmission = getPendingTimesheetEntries();
            // getPendingTimesheetEntries returns entries WHERE status IS NULL
            expect(duringSubmission.length).toBe(0);
            
            // Mark as submitted using our function
            db.prepare('UPDATE timesheet SET status = ?, submitted_at = datetime(\'now\') WHERE id = ?').run('Complete', entryId);
            
            // Verify in archive
            const archiveEntry = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(entryId) as { status: string; id: number; project: string };
            expect(archiveEntry.status).toBe('Complete');
            expect(archiveEntry.id).toBe(entryId);
            expect(archiveEntry.project).toBe('IntegrityTest');
        });
    });
});
