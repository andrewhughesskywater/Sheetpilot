/**
 * @fileoverview Integration tests for the complete IPC workflow
 * 
 * Tests the full workflow from IPC handler through database to bot automation.
 * These tests catch issues with the complete integration chain.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
    ensureSchema, 
    insertTimesheetEntry, 
    getPendingTimesheetEntries,
    setDbPath,
    openDb
} from '../src/services/database';
import { submitTimesheets } from '../src/services/timesheet_importer';
import * as fs from 'fs';
import * as path from 'path';

describe('IPC Workflow Integration', () => {
    const testDbPath = path.join(__dirname, 'test_ipc_workflow.db');
    
    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        setDbPath(testDbPath);
        ensureSchema();
    });
    
    afterEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    it('should handle workflow when database has pending entries', async () => {
        // Simulate user adding entries through the UI
        insertTimesheetEntry({
            date: '2025-01-15',
            timeIn: 540,
            timeOut: 600,
            project: 'TestProject',
            taskDescription: 'Test task'
        });

        // Verify entries are pending
        const pending = getPendingTimesheetEntries();
        expect(pending).toHaveLength(1);
        expect(pending[0].status).toBeNull();

        // Simulate automation button click (IPC handler calls submitTimesheets)
        const result = await submitTimesheets('test@example.com', 'password123');
        
        // Should attempt to process the entry
        expect(result).toBeDefined();
        expect(result.totalProcessed).toBe(1);
        
        // Even if submission fails (expected in test), it should not fail with browser init error
        if (!result.ok && result.errors) {
            const errorMessages = result.errors?.map((e: any) => e[1]).join(' ').toLowerCase();
            expect(errorMessages).not.toContain('page is not available');
            expect(errorMessages).not.toContain('call start() first');
        }
    });

    it('should handle workflow when database is empty', async () => {
        // No entries in database
        const pending = getPendingTimesheetEntries();
        expect(pending).toHaveLength(0);

        // Simulate automation button click with no pending entries
        const result = await submitTimesheets('test@example.com', 'password123');
        
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
            taskDescription: 'Test task'
        });

        const beforeSubmit = getPendingTimesheetEntries();
        const entryIdBefore = beforeSubmit[0].id;

        // Attempt submission (will fail in test environment)
        await submitTimesheets('test@example.com', 'password123');

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
            { date: '2025-01-16', timeIn: 540, timeOut: 600, project: 'Project-C', taskDescription: 'Task C' }
        ];

        entries.forEach(entry => insertTimesheetEntry(entry));

        const pending = getPendingTimesheetEntries();
        expect(pending).toHaveLength(3);

        // Attempt to submit all
        const result = await submitTimesheets('test@example.com', 'password123');
        
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
            taskDescription: 'Test task'
        });

        const beforeAttempt = getPendingTimesheetEntries();
        const originalEntry = beforeAttempt[0];

        // First automation attempt
        await submitTimesheets('test@example.com', 'password123');

        // Second automation attempt
        await submitTimesheets('test@example.com', 'password123');

        // Verify data hasn't been corrupted
        const db = openDb();
        const getEntry = db.prepare('SELECT * FROM timesheet WHERE id = ?');
        const currentEntry = getEntry.get(originalEntry.id);
        db.close();

        expect(currentEntry.project).toBe(originalEntry.project);
        expect(currentEntry.tool).toBe(originalEntry.tool);
        expect(currentEntry.detail_charge_code).toBe(originalEntry.detail_charge_code);
        expect(currentEntry.task_description).toBe(originalEntry.task_description);
    });
});

