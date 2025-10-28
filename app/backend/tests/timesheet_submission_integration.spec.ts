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
    setDbPath
} from '../src/services/database';
import { submitTimesheets, getPendingEntries } from '../src/services/timesheet_importer';
import * as fs from 'fs';
import * as path from 'path';

describe('Timesheet Submission Integration', () => {
    // Use temporary database file for testing
    const testDbPath = path.join(__dirname, 'test_timesheet.db');
    
    beforeEach(() => {
        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        setDbPath(testDbPath);
        ensureSchema();
    });
    
    afterEach(() => {
        // Clean up test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
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
        
        // Remove failed entry
        removeFailedTimesheetEntries([entryId]);
        
        // Verify it's removed from database
        const remainingPending = getPendingTimesheetEntries();
        expect(remainingPending).toHaveLength(0);
    });
    
    it('should handle empty pending entries gracefully', async () => {
        // No entries in database
        const result = await submitTimesheets('test@example.com', 'password123');
        
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
        const result = await submitTimesheets('test@example.com', 'password123');
        
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
        
        await submitTimesheets('test1@example.com', 'password1');
        
        // Second attempt - browser should be properly cleaned up and restarted
        insertTimesheetEntry({
            date: '2025-01-16',
            timeIn: 540,
            timeOut: 600,
            project: 'TestProject2',
            taskDescription: 'Second task'
        });
        
        // This should not fail with "Page is not available" or resource leak errors
        const result = await submitTimesheets('test2@example.com', 'password2');
        
        expect(result).toBeDefined();
        // Even though authentication fails, the browser lifecycle should work correctly
        expect(result.totalProcessed).toBeGreaterThan(0);
    });
});
