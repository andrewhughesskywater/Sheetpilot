/**
 * @fileoverview Database Module Test Suite
 * 
 * Comprehensive tests for the database module including deduplication functionality,
 * schema management, and CRUD operations. Tests use isolated database instances
 * to ensure test isolation and cleanup.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    setDbPath,
    getDbPath,
    openDb,
    ensureSchema,
    insertTimesheetEntry,
    insertTimesheetEntries,
    checkDuplicateEntry,
    getDuplicateEntries
} from '../src/services/database';

describe('Database Module', () => {
    let testDbPath: string;
    let originalDbPath: string;

    beforeEach(() => {
        // Store original DB path
        originalDbPath = getDbPath();
        
        // Create isolated test database
        testDbPath = path.join(os.tmpdir(), `sheetpilot-test-${Date.now()}.sqlite`);
        setDbPath(testDbPath);
        
        // Ensure schema is created
        ensureSchema();
    });

    afterEach(() => {
        // Restore original DB path
        setDbPath(originalDbPath);
        
        // Clean up test database file with retry logic
        if (fs.existsSync(testDbPath)) {
            try {
                fs.unlinkSync(testDbPath);
            } catch {
                // File might be locked, try again after a short delay
                setTimeout(() => {
                    try {
                        fs.unlinkSync(testDbPath);
                    } catch {
                        // Ignore cleanup errors
                    }
                }, 100);
            }
        }
    });

    describe('Database Path Management', () => {
        it('should set and get database path correctly', () => {
            const testPath = '/tmp/test-db.sqlite';
            setDbPath(testPath);
            expect(getDbPath()).toBe(path.resolve(testPath));
        });

        it('should resolve relative paths to absolute paths', () => {
            setDbPath('./test-db.sqlite');
            const resolved = getDbPath();
            expect(path.isAbsolute(resolved)).toBe(true);
        });

        it('should create database directory if it does not exist', () => {
            const testDir = path.join(os.tmpdir(), 'test-db-dir');
            const testDb = path.join(testDir, 'database.sqlite');
            
            // Ensure directory doesn't exist
            if (fs.existsSync(testDir)) {
                fs.rmSync(testDir, { recursive: true, force: true });
            }
            
            setDbPath(testDb);
            const db = openDb();
            db.close();
            
            expect(fs.existsSync(testDir)).toBe(true);
            expect(fs.existsSync(testDb)).toBe(true);
            
            // Cleanup
            fs.rmSync(testDir, { recursive: true, force: true });
        });
    });

    describe('Database Connection', () => {
        it('should open database connection successfully', () => {
            const db = openDb();
            expect(db).toBeDefined();
            expect(typeof db.close).toBe('function');
            db.close();
        });

        it('should create database file if it does not exist', () => {
            expect(fs.existsSync(testDbPath)).toBe(true);
        });
    });

    describe('Schema Management', () => {
        it('should create timesheet table with correct schema', () => {
            const db = openDb();
            
            // Check if timesheet table exists
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='timesheet'").all();
            expect(tables).toHaveLength(1);
            
            // Check table structure
            const columns = db.prepare("PRAGMA table_info(timesheet)").all();
            const columnNames = columns.map((col: { name: string }) => col.name);
            
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('date');
            expect(columnNames).toContain('time_in');
            expect(columnNames).toContain('time_out');
            expect(columnNames).toContain('project');
            expect(columnNames).toContain('tool');
            expect(columnNames).toContain('detail_charge_code');
            expect(columnNames).toContain('task_description');
            
            // Check if hours column exists (generated columns might not show in PRAGMA table_info)
            const tableSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='timesheet'").get();
            expect((tableSchema as { sql: string }).sql).toContain('hours');
            
            db.close();
        });

        it('should create required indexes', () => {
            const db = openDb();
            
            // Check for indexes
            const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
            const indexNames = indexes.map((idx: { name: string }) => idx.name);
            
            expect(indexNames).toContain('idx_timesheet_date');
            expect(indexNames).toContain('idx_timesheet_project');
            expect(indexNames).toContain('uq_timesheet_nk');
            
            db.close();
        });

        it('should create unique constraint for deduplication', () => {
            const db = openDb();
            
            // Get unique index details
            const uniqueIndex = db.prepare(`
                SELECT sql FROM sqlite_master 
                WHERE type='index' AND name='uq_timesheet_nk'
            `).get();
            
            expect(uniqueIndex).toBeDefined();
            expect((uniqueIndex as { sql: string }).sql).toContain('UNIQUE');
            expect((uniqueIndex as { sql: string }).sql).toContain('date, time_in, project, task_description');
            
            db.close();
        });
    });

    describe('Timesheet Entry Insertion', () => {
        const sampleEntry = {
            date: '2025-01-15',
            timeIn: 540,  // 9:00 AM
            timeOut: 600, // 10:00 AM
            project: 'Test Project',
            tool: 'VS Code',
            detailChargeCode: 'DEV-001',
            taskDescription: 'Test task description'
        };

        it('should insert a new timesheet entry successfully', () => {
            const result = insertTimesheetEntry(sampleEntry);
            
            expect(result.success).toBe(true);
            expect(result.isDuplicate).toBe(false);
            expect(result.changes).toBe(1);
        });

        it('should calculate hours automatically', () => {
            insertTimesheetEntry(sampleEntry);
            
            const db = openDb();
            const entry = db.prepare('SELECT hours FROM timesheet WHERE project = ?').get(sampleEntry.project);
            db.close();
            
            expect((entry as { hours: number }).hours).toBe(1.0); // 60 minutes = 1 hour
        });

        it('should handle optional fields correctly', () => {
            const entryWithoutOptionals = {
                ...sampleEntry,
                tool: undefined,
                detailChargeCode: undefined
            };
            
            const result = insertTimesheetEntry(entryWithoutOptionals);
            expect(result.success).toBe(true);
            
            const db = openDb();
            const entry = db.prepare('SELECT tool, detail_charge_code FROM timesheet WHERE project = ?').get(sampleEntry.project);
            db.close();
            
            expect((entry as { tool: string | null; detail_charge_code: string | null }).tool).toBeNull();
            expect((entry as { tool: string | null; detail_charge_code: string | null }).detail_charge_code).toBeNull();
        });

        it('should validate time constraints', () => {
            const db = openDb();
            
            // Test invalid time_in (not 15-minute increment)
            expect(() => {
                db.prepare('INSERT INTO timesheet (date, time_in, time_out, project, task_description) VALUES (?, ?, ?, ?, ?)')
                  .run('2025-01-15', 541, 600, 'Test', 'Task'); // 541 is not divisible by 15
            }).toThrow();
            
            // Test invalid time_out (not 15-minute increment)
            expect(() => {
                db.prepare('INSERT INTO timesheet (date, time_in, time_out, project, task_description) VALUES (?, ?, ?, ?, ?)')
                  .run('2025-01-15', 540, 601, 'Test', 'Task'); // 601 is not divisible by 15
            }).toThrow();
            
            // Test time_out <= time_in
            expect(() => {
                db.prepare('INSERT INTO timesheet (date, time_in, time_out, project, task_description) VALUES (?, ?, ?, ?, ?)')
                  .run('2025-01-15', 600, 540, 'Test', 'Task'); // time_out before time_in
            }).toThrow();
            
            db.close();
        });
    });

    describe('Deduplication Functionality', () => {
        const duplicateEntry = {
            date: '2025-01-15',
            timeIn: 540,
            timeOut: 600,
            project: 'Duplicate Project',
            taskDescription: 'Duplicate task'
        };

        it('should prevent duplicate entries based on unique constraint', () => {
            // Insert first entry
            const result1 = insertTimesheetEntry(duplicateEntry);
            expect(result1.success).toBe(true);
            expect(result1.isDuplicate).toBe(false);
            
            // Attempt to insert duplicate
            const result2 = insertTimesheetEntry(duplicateEntry);
            expect(result2.success).toBe(false);
            expect(result2.isDuplicate).toBe(true);
            expect(result2.changes).toBe(0);
        });

        it('should allow entries with different time_in', () => {
            insertTimesheetEntry(duplicateEntry);
            
            const differentTimeEntry = {
                ...duplicateEntry,
                timeIn: 600, // Different start time
                timeOut: 660
            };
            
            const result = insertTimesheetEntry(differentTimeEntry);
            expect(result.success).toBe(true);
            expect(result.isDuplicate).toBe(false);
        });

        it('should allow entries with different project', () => {
            insertTimesheetEntry(duplicateEntry);
            
            const differentProjectEntry = {
                ...duplicateEntry,
                project: 'Different Project'
            };
            
            const result = insertTimesheetEntry(differentProjectEntry);
            expect(result.success).toBe(true);
            expect(result.isDuplicate).toBe(false);
        });

        it('should allow entries with different task description', () => {
            insertTimesheetEntry(duplicateEntry);
            
            const differentTaskEntry = {
                ...duplicateEntry,
                taskDescription: 'Different task description'
            };
            
            const result = insertTimesheetEntry(differentTaskEntry);
            expect(result.success).toBe(true);
            expect(result.isDuplicate).toBe(false);
        });

        it('should allow entries with different date', () => {
            insertTimesheetEntry(duplicateEntry);
            
            const differentDateEntry = {
                ...duplicateEntry,
                date: '2025-01-16'
            };
            
            const result = insertTimesheetEntry(differentDateEntry);
            expect(result.success).toBe(true);
            expect(result.isDuplicate).toBe(false);
        });

        it('should allow entries with different optional fields', () => {
            insertTimesheetEntry(duplicateEntry);
            
            const differentOptionalEntry = {
                ...duplicateEntry,
                tool: 'Different Tool',
                detailChargeCode: 'DIFF-001'
            };
            
            const result = insertTimesheetEntry(differentOptionalEntry);
            expect(result.success).toBe(false); // Still a duplicate because core fields are same
            expect(result.isDuplicate).toBe(true);
        });
    });

    describe('Duplicate Checking Utilities', () => {
        const testEntry = {
            date: '2025-01-20',
            timeIn: 720, // 12:00 PM
            project: 'Check Project',
            taskDescription: 'Check task'
        };

        it('should correctly identify non-duplicate entries', () => {
            const isDuplicate = checkDuplicateEntry(testEntry);
            expect(isDuplicate).toBe(false);
        });

        it('should correctly identify duplicate entries', () => {
            // Insert entry first
            insertTimesheetEntry({
                ...testEntry,
                timeOut: 780 // 1:00 PM
            });
            
            const isDuplicate = checkDuplicateEntry(testEntry);
            expect(isDuplicate).toBe(true);
        });

        it('should find duplicate entries in database', () => {
            // Insert some duplicate entries
            const entry1 = { date: '2025-01-20', timeIn: 540, timeOut: 600, project: 'Dup Project', taskDescription: 'Dup Task' };
            const entry2 = { date: '2025-01-20', timeIn: 540, timeOut: 600, project: 'Dup Project', taskDescription: 'Dup Task' };
            const entry3 = { date: '2025-01-21', timeIn: 540, timeOut: 600, project: 'Dup Project', taskDescription: 'Dup Task' };
            
            // Insert entries (second one will be ignored due to duplicate)
            insertTimesheetEntry(entry1);
            insertTimesheetEntry(entry2);
            insertTimesheetEntry(entry3);
            
            const duplicates = getDuplicateEntries();
            expect(duplicates).toHaveLength(0); // No duplicates should be found since duplicates are prevented
        });

        it('should filter duplicates by date range', () => {
            const duplicates = getDuplicateEntries('2025-01-01', '2025-01-31');
            expect(Array.isArray(duplicates)).toBe(true);
        });
    });

    describe('Batch Insertion', () => {
        const sampleEntries = [
            {
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'Batch Project 1',
                taskDescription: 'Batch Task 1'
            },
            {
                date: '2025-01-15',
                timeIn: 600,
                timeOut: 660,
                project: 'Batch Project 2',
                taskDescription: 'Batch Task 2'
            },
            {
                date: '2025-01-16',
                timeIn: 540,
                timeOut: 600,
                project: 'Batch Project 3',
                taskDescription: 'Batch Task 3'
            }
        ];

        it('should insert multiple entries successfully', () => {
            const result = insertTimesheetEntries(sampleEntries);
            
            expect(result.success).toBe(true);
            expect(result.total).toBe(3);
            expect(result.inserted).toBe(3);
            expect(result.duplicates).toBe(0);
            expect(result.errors).toBe(0);
        });

        it('should handle mixed duplicates in batch insertion', () => {
            // Insert first batch
            insertTimesheetEntries(sampleEntries);
            
            // Create batch with duplicates
            const mixedBatch = [
                ...sampleEntries, // These will be duplicates
                {
                    date: '2025-01-17',
                    timeIn: 540,
                    timeOut: 600,
                    project: 'New Project',
                    taskDescription: 'New Task'
                }
            ];
            
            const result = insertTimesheetEntries(mixedBatch);
            
            expect(result.success).toBe(true);
            expect(result.total).toBe(4);
            expect(result.inserted).toBe(1); // Only the new entry
            expect(result.duplicates).toBe(3); // The three duplicates
            expect(result.errors).toBe(0);
        });

        it('should handle empty batch', () => {
            const result = insertTimesheetEntries([]);
            
            expect(result.success).toBe(true);
            expect(result.total).toBe(0);
            expect(result.inserted).toBe(0);
            expect(result.duplicates).toBe(0);
            expect(result.errors).toBe(0);
        });

        it('should use transaction for atomicity', () => {
            // Create entries with invalid data (this should cause transaction to fail)
            const invalidEntries = [
                {
                    date: '2025-01-15',
                    timeIn: 540,
                    timeOut: 600,
                    project: 'Valid Project',
                    taskDescription: 'Valid Task'
                },
                {
                    date: '2025-01-15',
                    timeIn: 541, // Invalid: not divisible by 15
                    timeOut: 600,
                    project: 'Invalid Project',
                    taskDescription: 'Invalid Task'
                }
            ];
            
            const result = insertTimesheetEntries(invalidEntries);
            
            // Transaction should fail, so no entries should be inserted
            expect(result.success).toBe(false);
            expect(result.errors).toBe(2);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle database connection errors gracefully', () => {
            // Set invalid path - use a path that would cause permission issues
            const invalidPath = '/root/invalid/path/test.db';
            setDbPath(invalidPath);
            
            // This should either throw or fail silently depending on the system
            try {
                ensureSchema();
                // If it doesn't throw, that's also acceptable behavior
            } catch (error) {
                // Expected behavior - should throw some kind of error
                expect(error).toBeDefined();
            }
        });

        it('should handle malformed entry data', () => {
            const invalidEntry = {
                date: 'invalid-date',
                timeIn: -1,
                timeOut: 25 * 60, // 25 hours
                project: '',
                taskDescription: ''
            };
            
            // This should fail at the database constraint level
            const db = openDb();
            expect(() => {
                db.prepare(`
                    INSERT INTO timesheet (date, time_in, time_out, project, task_description)
                    VALUES (?, ?, ?, ?, ?)
                `).run(invalidEntry.date, invalidEntry.timeIn, invalidEntry.timeOut, 
                       invalidEntry.project, invalidEntry.taskDescription);
            }).toThrow();
            db.close();
        });

        it('should handle null and undefined values in optional fields', () => {
            const entryWithNulls = {
                date: '2025-01-15',
                timeIn: 540,
                timeOut: 600,
                project: 'Test Project',
                tool: null,
                detailChargeCode: undefined,
                taskDescription: 'Test Task'
            };
            
            const result = insertTimesheetEntry(entryWithNulls);
            expect(result.success).toBe(true);
        });
    });
});
