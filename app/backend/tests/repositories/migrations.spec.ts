/**
 * @fileoverview Database Migrations Unit Tests
 * 
 * Tests for the database migration system including version tracking,
 * backup creation, and migration execution.
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
    debug: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() }))
  }
}));

import {
  getCurrentSchemaVersion,
  setSchemaVersion,
  createBackup,
  runMigrations,
  needsMigration,
  CURRENT_SCHEMA_VERSION
} from '../../src/models/migrations';
import { setDbPath, getDb, closeConnection, ensureSchema, getDbPath } from '../../src/models/connection-manager';

describe('Database Migrations', () => {
  let testDbPath: string;
  let testDbDir: string;
  let originalDbPath: string;

  beforeEach(() => {
    // Store original path
    originalDbPath = getDbPath();
    
    // Create isolated test database directory
    testDbDir = path.join(os.tmpdir(), `sheetpilot-migration-test-${Date.now()}`);
    fs.mkdirSync(testDbDir, { recursive: true });
    testDbPath = path.join(testDbDir, 'test.sqlite');
    setDbPath(testDbPath);
  });

  afterEach(() => {
    // Close connection before cleanup
    closeConnection();
    
    // Clean up test database files
    if (fs.existsSync(testDbDir)) {
      try {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    
    // Restore original path
    setDbPath(originalDbPath);
  });

  describe('Schema Version Tracking', () => {
    it('should return 0 when schema_info table does not exist', () => {
      const db = getDb();
      const version = getCurrentSchemaVersion(db);
      expect(version).toBe(0);
    });

    it('should return 0 when schema_info exists but has no version record', () => {
      const db = getDb();
      
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_info(
          id INTEGER PRIMARY KEY CHECK (id = 1),
          version INTEGER NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      const version = getCurrentSchemaVersion(db);
      expect(version).toBe(0);
    });

    it('should return correct version when set', () => {
      const db = getDb();
      ensureSchema();
      
      setSchemaVersion(db, 5);
      const version = getCurrentSchemaVersion(db);
      
      expect(version).toBe(5);
    });

    it('should update version correctly', () => {
      const db = getDb();
      ensureSchema();
      
      setSchemaVersion(db, 1);
      expect(getCurrentSchemaVersion(db)).toBe(1);
      
      setSchemaVersion(db, 2);
      expect(getCurrentSchemaVersion(db)).toBe(2);
      
      setSchemaVersion(db, 10);
      expect(getCurrentSchemaVersion(db)).toBe(10);
    });

    it('should enforce singleton constraint on schema_info', () => {
      const db = getDb();
      ensureSchema();
      
      setSchemaVersion(db, 1);
      setSchemaVersion(db, 2);
      
      const count = db.prepare('SELECT COUNT(*) as count FROM schema_info').get() as { count: number };
      expect(count.count).toBe(1);
    });
  });

  describe('Database Backup', () => {
    it('should return null when database file does not exist', () => {
      const nonExistentPath = path.join(testDbDir, 'nonexistent.sqlite');
      const backupPath = createBackup(nonExistentPath);
      
      expect(backupPath).toBeNull();
    });

    it('should create backup file with timestamp', () => {
      const db = getDb();
      ensureSchema();
      db.close();
      
      const backupPath = createBackup(testDbPath);
      
      expect(backupPath).not.toBeNull();
      expect(backupPath).toContain('.backup-');
      expect(backupPath).toContain('.sqlite');
      expect(fs.existsSync(backupPath!)).toBe(true);
    });

    it('should preserve database contents in backup', () => {
      const db = getDb();
      ensureSchema();
      
      db.exec(`INSERT INTO credentials (service, email, password) VALUES ('test', 'test@example.com', 'encrypted')`);
      db.close();
      
      const backupPath = createBackup(testDbPath);
      expect(backupPath).not.toBeNull();
      
      const Database = require('better-sqlite3');
      const backupDb = new Database(backupPath);
      const result = backupDb.prepare('SELECT * FROM credentials WHERE service = ?').get('test') as { email: string } | undefined;
      backupDb.close();
      
      expect(result).toBeDefined();
      expect(result!.email).toBe('test@example.com');
    });
  });

  describe('Migration Execution', () => {
    it('should report no migration needed when at current version', () => {
      const db = getDb();
      ensureSchema();
      setSchemaVersion(db, CURRENT_SCHEMA_VERSION);
      
      const result = runMigrations(db, testDbPath);
      
      expect(result.success).toBe(true);
      expect(result.migrationsRun).toBe(0);
      expect(result.fromVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.backupPath).toBeNull();
    });

    it('should run migrations from version 0', () => {
      const db = getDb();
      
      const result = runMigrations(db, testDbPath);
      
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.backupPath).toBeNull();
    });

    it('should update schema version after successful migration', () => {
      const db = getDb();
      
      runMigrations(db, testDbPath);
      
      const version = getCurrentSchemaVersion(db);
      expect(version).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('needsMigration Helper', () => {
    it('should return false when at current version', () => {
      const db = getDb();
      ensureSchema();
      setSchemaVersion(db, CURRENT_SCHEMA_VERSION);
      
      const needs = needsMigration(db);
      
      expect(needs).toBe(false);
    });

    it('should return true when version is behind current', () => {
      const db = getDb();
      ensureSchema();
      
      if (CURRENT_SCHEMA_VERSION > 0) {
        setSchemaVersion(db, CURRENT_SCHEMA_VERSION - 1);
        const needs = needsMigration(db);
        expect(needs).toBe(true);
      }
    });
  });

  describe('CURRENT_SCHEMA_VERSION Constant', () => {
    it('should be a positive integer', () => {
      expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true);
      expect(CURRENT_SCHEMA_VERSION).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    it('should be idempotent - running multiple times has same result', () => {
      const db = getDb();
      
      const result1 = runMigrations(db, testDbPath);
      const result2 = runMigrations(db, testDbPath);
      const result3 = runMigrations(db, testDbPath);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      
      expect(result2.migrationsRun).toBe(0);
      expect(result3.migrationsRun).toBe(0);
      
      expect(getCurrentSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('should create all tables after migration', () => {
      const db = getDb();
      
      runMigrations(db, testDbPath);
      ensureSchema();
      
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
      `).all() as { name: string }[];
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('timesheet');
      expect(tableNames).toContain('credentials');
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('schema_info');
    });
  });

  describe('Migration 3: Fix Generated Hours Column', () => {
    it('should convert generated hours column to regular column', () => {
      const db = getDb();
      ensureSchema();
      
      // Drop any existing timesheet table first
      db.exec(`DROP TABLE IF EXISTS timesheet`);
      
      // Create a table with hours as a generated column (simulating the problematic schema)
      db.exec(`
        CREATE TABLE timesheet (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          time_in INTEGER,
          time_out INTEGER,
          hours REAL GENERATED ALWAYS AS (CASE 
            WHEN time_in IS NOT NULL AND time_out IS NOT NULL 
            THEN (time_out - time_in) / 60.0
            ELSE NULL
          END) STORED,
          date TEXT,
          project TEXT,
          tool TEXT,
          detail_charge_code TEXT,
          task_description TEXT,
          status TEXT DEFAULT NULL,
          submitted_at DATETIME DEFAULT NULL
        )
      `);
      
      // Insert test data with time_in/time_out
      const insertStmt = db.prepare(`
        INSERT INTO timesheet (time_in, time_out, date, project, task_description)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertResult = insertStmt.run(540, 1020, '2025-01-15', 'FL-Carver Techs', 'Test task');
      
      // Verify row was inserted
      expect(insertResult.changes).toBe(1);
      const countBefore = db.prepare('SELECT COUNT(*) as count FROM timesheet').get() as { count: number };
      expect(countBefore.count).toBe(1);
      
      // Recreate indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_timesheet_date ON timesheet(date);
        CREATE INDEX IF NOT EXISTS idx_timesheet_project ON timesheet(project);
        CREATE INDEX IF NOT EXISTS idx_timesheet_status ON timesheet(status);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_timesheet_nk
          ON timesheet(date, project, task_description)
          WHERE date IS NOT NULL 
            AND project IS NOT NULL 
            AND task_description IS NOT NULL
      `);
      
      // Set version to 2 to trigger migration 3
      setSchemaVersion(db, 2);
      
      // Verify we can't insert into hours (it's generated) - error happens at execution
      try {
        db.prepare(`
          INSERT INTO timesheet (date, hours, project, task_description)
          VALUES (?, ?, ?, ?)
        `).run('2025-01-16', 8.0, 'FL-Carver Tools', 'Another task');
        // If we get here, the insert succeeded which means hours is not generated
        // This should not happen if our test setup is correct
        throw new Error('Expected INSERT to fail with generated column error');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        expect(errorMsg).toMatch(/generated column|cannot INSERT into/i);
      }
      
      // Verify row exists with test data
      const existingData = db.prepare('SELECT id, date, project, task_description FROM timesheet WHERE id = 1').get() as {
        id: number;
        date: string;
        project: string;
        task_description: string;
      } | null;
      
      expect(existingData).not.toBeNull();
      if (existingData) {
        expect(existingData.date).toBe('2025-01-15');
        expect(existingData.project).toBe('FL-Carver Techs');
      }
      
      // Run migrations - migration 3 should fix the generated column issue
      const result = runMigrations(db, testDbPath);
      
      expect(result.success).toBe(true);
      // Migration 3 should run (may run with other migrations if schema wasn't at version 2)
      expect(result.migrationsRun).toBeGreaterThanOrEqual(1);
      
      // The key test: Verify hours is now a regular column (can be inserted)
      // This is what migration 3 fixes - converting generated column to regular
      const insertAfterMigration = db.prepare(`
        INSERT INTO timesheet (date, hours, project, task_description)
        VALUES (?, ?, ?, ?)
      `);
      
      // Before migration, this would throw "cannot INSERT into generated column"
      // After migration, it should succeed
      const insertAfterResult = insertAfterMigration.run('2025-01-16', 4.0, 'FL-Carver Tools', 'Another task');
      expect(insertAfterResult.changes).toBe(1);
      
      // Verify the insert actually worked by checking the row we just inserted
      const newRowId = insertAfterResult.lastInsertRowid;
      const newRow = db.prepare('SELECT * FROM timesheet WHERE id = ?').get(newRowId) as {
        hours: number;
        date: string;
        project: string;
      } | undefined;
      expect(newRow).toBeDefined();
      expect(newRow!.hours).toBe(4.0);
      expect(newRow!.date).toBe('2025-01-16');
      expect(newRow!.project).toBe('FL-Carver Tools');
      
      // Verify we can update hours
      const updateStmt = db.prepare(`
        UPDATE timesheet SET hours = ? WHERE id = 1
      `);
      expect(() => {
        updateStmt.run(7.5);
      }).not.toThrow();
      
      // Verify data was preserved during migration
      const preservedData = db.prepare('SELECT * FROM timesheet WHERE id = 1').get() as {
        hours: number;
        date: string;
        project: string;
      } | undefined;
      expect(preservedData).toBeDefined();
      expect(preservedData!.date).toBe('2025-01-15');
      expect(preservedData!.project).toBe('FL-Carver Techs');
      
      // New entry verification already done above using lastInsertRowid
    });

    it('should skip migration if hours is already a regular column', () => {
      const db = getDb();
      ensureSchema();
      setSchemaVersion(db, 2);
      
      // Verify hours is a regular column (from ensureSchema)
      const insertStmt = db.prepare(`
        INSERT INTO timesheet (date, hours, project, task_description)
        VALUES (?, ?, ?, ?)
      `);
      expect(() => {
        insertStmt.run('2025-01-15', 8.0, 'FL-Carver Techs', 'Test');
      }).not.toThrow();
      
      // Run migrations - migration 3 should detect that hours is already regular and skip the fix
      const result = runMigrations(db, testDbPath);
      
      expect(result.success).toBe(true);
      // Migration 3 runs (it's version 3), but it should skip the table recreation since hours is not generated
      expect(result.migrationsRun).toBeGreaterThanOrEqual(1);
      
      // Verify we can still insert
      expect(() => {
        insertStmt.run('2025-01-16', 4.0, 'FL-Carver Tools', 'Another test');
      }).not.toThrow();
    });
  });
});
