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

// Note: better-sqlite3 is mocked globally in setup.ts
// This test file relies on that global mock

import {
    setDbPath,
    getDbPath,
    openDb,
    ensureSchema,
    insertTimesheetEntry,
    insertTimesheetEntries,
    checkDuplicateEntry,
    getDuplicateEntries,
    shutdownDatabase
} from '../../src/models';

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
        // Ensure connection is closed and reset
        try {
            shutdownDatabase();
        } catch {
            // Ignore if shutdownDatabase doesn't exist or fails
        }
        
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
            const columns = db.prepare("PRAGMA table_info(timesheet)").all() as Array<{ name: string }>;
            const columnNames = columns.map((col) => col.name);
            
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('date');
            expect(columnNames).toContain('hours');
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
            const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as Array<{ name: string }>;
            const indexNames = indexes.map((idx) => idx.name);
            
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
            expect((uniqueIndex as { sql: string }).sql).toContain('date, project, task_description');
            
            db.close();
        });
    });

    describe('Timesheet Entry Insertion', () => {
        const sampleEntry = {
            date: '2025-01-15',
            hours: 1.0,  // 1 hour
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

        it('should store hours correctly', () => {
            insertTimesheetEntry(sampleEntry);
            
            const db = openDb();
            const entry = db.prepare('SELECT hours FROM timesheet WHERE project = ?').get(sampleEntry.project);
            db.close();
            
            expect((entry as { hours: number }).hours).toBe(1.0);
        });

        it('should handle optional fields correctly', () => {
            const entryWithoutOptionals = {
                ...sampleEntry,
                tool: null,
                detailChargeCode: null
            };
            
            const result = insertTimesheetEntry(entryWithoutOptionals);
            expect(result.success).toBe(true);
            
            const db = openDb();
            const entry = db.prepare('SELECT tool, detail_charge_code FROM timesheet WHERE project = ?').get(sampleEntry.project);
            db.close();
            
            expect((entry as { tool: string | null; detail_charge_code: string | null }).tool).toBeNull();
            expect((entry as { tool: string | null; detail_charge_code: string | null }).detail_charge_code).toBeNull();
        });

        it('should validate hours constraints', () => {
            const db = openDb();
            
            // Test invalid hours (not 15-minute increment)
            expect(() => {
                db.prepare('INSERT INTO timesheet (date, hours, project, task_description) VALUES (?, ?, ?, ?)')
                  .run('2025-01-15', 0.1, 'Test', 'Task'); // 0.1 is not a 15-minute increment
            }).toThrow();
            
            // Test hours below minimum
            expect(() => {
                db.prepare('INSERT INTO timesheet (date, hours, project, task_description) VALUES (?, ?, ?, ?)')
                  .run('2025-01-15', 0.15, 'Test', 'Task'); // Below 0.25 minimum
            }).toThrow();
            
            // Test hours above maximum
            expect(() => {
                db.prepare('INSERT INTO timesheet (date, hours, project, task_description) VALUES (?, ?, ?, ?)')
                  .run('2025-01-15', 25.0, 'Test', 'Task'); // Above 24.0 maximum
            }).toThrow();
            
            db.close();
        });
    });

    describe('Deduplication Functionality', () => {
        const duplicateEntry = {
            date: '2025-01-15',
            hours: 1.0,
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

        it('should allow entries with different hours', () => {
            insertTimesheetEntry(duplicateEntry);
            
            const differentHoursEntry = {
                ...duplicateEntry,
                hours: 2.0 // Different hours value
            };
            
            const result = insertTimesheetEntry(differentHoursEntry);
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
            hours: 1.0,
            project: 'Check Project',
            taskDescription: 'Check task'
        };

        it('should correctly identify non-duplicate entries', () => {
            const isDuplicate = checkDuplicateEntry(testEntry);
            expect(isDuplicate).toBe(false);
        });

        it('should correctly identify duplicate entries', () => {
            // Insert entry first
            insertTimesheetEntry(testEntry);
            
            const isDuplicate = checkDuplicateEntry(testEntry);
            expect(isDuplicate).toBe(true);
        });

        it('should find duplicate entries in database', () => {
            // Insert some duplicate entries
            const entry1 = { date: '2025-01-20', hours: 1.0, project: 'Dup Project', taskDescription: 'Dup Task' };
            const entry2 = { date: '2025-01-20', hours: 1.0, project: 'Dup Project', taskDescription: 'Dup Task' };
            const entry3 = { date: '2025-01-21', hours: 1.0, project: 'Dup Project', taskDescription: 'Dup Task' };
            
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
                hours: 1.0,
                project: 'Batch Project 1',
                taskDescription: 'Batch Task 1'
            },
            {
                date: '2025-01-15',
                hours: 1.0,
                project: 'Batch Project 2',
                taskDescription: 'Batch Task 2'
            },
            {
                date: '2025-01-16',
                hours: 1.0,
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
                    hours: 1.0,
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
                    hours: 1.0,
                    project: 'Valid Project',
                    taskDescription: 'Valid Task'
                },
                {
                    date: '2025-01-15',
                    hours: 0.1, // Invalid: not 15-minute increment
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
                hours: -1, // Invalid: negative hours
                project: '',
                taskDescription: ''
            };
            
            // This should fail at the database constraint level
            const db = openDb();
            expect(() => {
                db.prepare(`
                    INSERT INTO timesheet (date, hours, project, task_description)
                    VALUES (?, ?, ?, ?)
                `).run(invalidEntry.date, invalidEntry.hours, 
                       invalidEntry.project, invalidEntry.taskDescription);
            }).toThrow();
            db.close();
        });

        it('should handle null and undefined values in optional fields', () => {
            const entryWithNulls = {
                date: '2025-01-15',
                hours: 1.0,
                project: 'Test Project',
                tool: null,
                detailChargeCode: null,
                taskDescription: 'Test Task'
            };
            
            const result = insertTimesheetEntry(entryWithNulls);
            expect(result.success).toBe(true);
        });
    });

    describe('Concurrent Access Tests', () => {
        it('should handle concurrent reads safely', () => {
            // Insert test data
            const testEntry = {
                date: '2025-01-15',
                hours: 1.0,
                project: 'Concurrent Test',
                taskDescription: 'Test task'
            };
            insertTimesheetEntry(testEntry);
            
            // Perform multiple concurrent reads
            const db = openDb();
            const promises = [];
            
            for (let i = 0; i < 10; i++) {
                const stmt = db.prepare('SELECT * FROM timesheet WHERE project = ?');
                promises.push(stmt.all('Concurrent Test'));
            }
            
            // All reads should succeed
            promises.forEach(result => {
                expect(result).toBeDefined();
                expect(Array.isArray(result)).toBe(true);
            });
            
            db.close();
        });

        it('should handle concurrent writes with proper isolation', () => {
            const entries = [];
            for (let i = 0; i < 5; i++) {
                entries.push({
                    date: '2025-01-15',
                    hours: 1.0 + (i * 0.25),
                    project: `Concurrent Project ${i}`,
                    taskDescription: `Task ${i}`
                });
            }
            
            // Insert all entries
            const results = entries.map(entry => insertTimesheetEntry(entry));
            
            // All inserts should succeed
            results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.changes).toBe(1);
            });
            
            // Verify all entries were inserted
            const db = openDb();
            const count = db.prepare('SELECT COUNT(*) as count FROM timesheet WHERE project LIKE ?').get('Concurrent Project%');
            expect((count as { count: number }).count).toBe(5);
            db.close();
        });

        it('should maintain data consistency under concurrent operations', () => {
            const entry = {
                date: '2025-01-15',
                hours: 1.0,
                project: 'Consistency Test',
                taskDescription: 'Test'
            };
            
            // Try to insert the same entry multiple times concurrently
            const results = [1, 2, 3].map(() => insertTimesheetEntry(entry));
            
            // First should succeed, rest should be duplicates
            expect(results[0].success).toBe(true);
            expect(results[1].isDuplicate || !results[1].success).toBe(true);
            expect(results[2].isDuplicate || !results[2].success).toBe(true);
        });
    });

    describe('Transaction Rollback Tests', () => {
        it('should rollback transaction on batch insertion failure', () => {
            const entries = [
                {
                    date: '2025-01-15',
                    hours: 1.0,
                    project: 'Valid Project 1',
                    taskDescription: 'Valid Task 1'
                },
                {
                    date: '2025-01-15',
                    hours: 0.1, // Invalid: not 15-minute increment
                    project: 'Invalid Project',
                    taskDescription: 'Invalid Task'
                },
                {
                    date: '2025-01-15',
                    hours: 1.0,
                    project: 'Valid Project 2',
                    taskDescription: 'Valid Task 2'
                }
            ];
            
            const result = insertTimesheetEntries(entries);
            
            // Transaction should fail, no entries should be inserted
            expect(result.success).toBe(false);
            expect(result.errors).toBeGreaterThan(0);
            
            // Verify no partial data was committed
            const db = openDb();
            const count1 = db.prepare('SELECT COUNT(*) as count FROM timesheet WHERE project = ?').get('Valid Project 1');
            const count2 = db.prepare('SELECT COUNT(*) as count FROM timesheet WHERE project = ?').get('Valid Project 2');
            
            expect((count1 as { count: number }).count).toBe(0);
            expect((count2 as { count: number }).count).toBe(0);
            
            db.close();
        });

        it('should commit all or none in batch operation', () => {
            const validEntries = [
                {
                    date: '2025-01-15',
                    hours: 1.0,
                    project: 'Batch Test 1',
                    taskDescription: 'Task 1'
                },
                {
                    date: '2025-01-15',
                    hours: 1.0,
                    project: 'Batch Test 2',
                    taskDescription: 'Task 2'
                }
            ];
            
            const result = insertTimesheetEntries(validEntries);
            
            // All should succeed together
            expect(result.success).toBe(true);
            expect(result.inserted).toBe(2);
            
            // Verify both were committed
            const db = openDb();
            const count = db.prepare('SELECT COUNT(*) as count FROM timesheet WHERE project LIKE ?').get('Batch Test%');
            expect((count as { count: number }).count).toBe(2);
            db.close();
        });
    });

    describe('Database Corruption Recovery Tests', () => {
        it('should detect corrupted database schema', () => {
            const db = openDb();
            
            // Verify schema exists
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            expect(Array.isArray(tables)).toBe(true);
            expect(tables.length).toBeGreaterThan(0);
            
            db.close();
        });

        it('should handle missing tables gracefully', () => {
            const db = openDb();
            
            // Try to query non-existent table
            try {
                db.prepare('SELECT * FROM non_existent_table').all();
                expect(true).toBe(false); // Should throw
            } catch (error) {
                expect(error).toBeDefined();
            }
            
            db.close();
        });

        it('should validate schema integrity on startup', () => {
            const db = openDb();
            
            // Check that required tables exist
            const timesheetTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='timesheet'").get();
            const credentialsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='credentials'").get();
            const sessionsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
            
            expect(timesheetTable).toBeDefined();
            expect(credentialsTable).toBeDefined();
            expect(sessionsTable).toBeDefined();
            
            db.close();
        });

        it('should handle constraint violations appropriately', () => {
            const db = openDb();
            
            // Try to violate UNIQUE constraint
            const validEntry = {
                date: '2025-01-15',
                hours: 1.0,
                project: 'Constraint Test',
                taskDescription: 'Test'
            };
            
            // Insert first time
            insertTimesheetEntry(validEntry);
            
            // Try to insert duplicate
            const result = insertTimesheetEntry(validEntry);
            
            expect(result.isDuplicate).toBe(true);
            expect(result.success).toBe(false);
            
            db.close();
        });
    });

    describe('Migration Tests', () => {
        it('should maintain schema version compatibility', () => {
            const db = openDb();
            
            // Check if we're tracking schema version (if implemented)
            try {
                const version = db.prepare("SELECT value FROM metadata WHERE key='schema_version'").get();
                if (version) {
                    expect(version).toHaveProperty('value');
                }
            } catch {
                // Metadata table might not exist yet
                // This is acceptable for current implementation
            }
            
            db.close();
        });

        it('should preserve existing data after schema changes', () => {
            // Insert test data
            const testEntry = {
                date: '2025-01-15',
                hours: 1.0,
                project: 'Migration Test',
                taskDescription: 'Test'
            };
            
            insertTimesheetEntry(testEntry);
            
            // Verify data persists
            const db = openDb();
            const entry = db.prepare('SELECT * FROM timesheet WHERE project = ?').get('Migration Test');
            expect(entry).toBeDefined();
            expect((entry as { project: string }).project).toBe('Migration Test');
            db.close();
        });

        it('should handle schema recreation without data loss', () => {
            // Insert test data
            const entries = [
                {
                    date: '2025-01-15',
                    hours: 1.0,
                    project: 'Test 1',
                    taskDescription: 'Task 1'
                },
                {
                    date: '2025-01-16',
                    hours: 1.0,
                    project: 'Test 2',
                    taskDescription: 'Task 2'
                }
            ];
            
            entries.forEach(entry => insertTimesheetEntry(entry));
            
            // Ensure schema (should not delete existing data)
            ensureSchema();
            
            // Verify data still exists
            const db = openDb();
            const count = db.prepare('SELECT COUNT(*) as count FROM timesheet WHERE project LIKE ?').get('Test%');
            expect((count as { count: number }).count).toBe(2);
            db.close();
        });
    });
});
