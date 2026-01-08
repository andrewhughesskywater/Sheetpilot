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
    audit: vi.fn(),
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
} from '../../src/repositories/migrations';
import { setDbPath, getDb, closeConnection, ensureSchema, getDbPath } from '../../src/repositories/connection-manager';

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

    // FIXME: These tests fail because fs.existsSync is mocked in setup.ts to only recognize
    // database paths added to createdDbPaths. When we manually create a file with writeFileSync,
    // the mocked existsSync doesn't find it. Need to either:
    // 1. Unmock fs for these specific tests
    // 2. Add a way to register paths with the mock
    // 3. Test backup functionality in integration tests instead
    it.skip('should create backup file with timestamp', async () => {
      // Use actual fs for this test
      const actualFs = await import('fs');
      
      const db = getDb();
      ensureSchema();
      db.close();
      
      // Ensure directory exists
      actualFs.mkdirSync(testDbDir, { recursive: true });
      
      // Create an actual file that backup can copy
      actualFs.writeFileSync(testDbPath, Buffer.from('SQLite format 3\0'));
      
      const backupPath = createBackup(testDbPath);
      
      expect(backupPath).not.toBeNull();
      expect(backupPath).toContain('.backup-');
      expect(backupPath).toContain('.sqlite');
      if (backupPath) {
        expect(actualFs.existsSync(backupPath)).toBe(true);
      }
    });

    it.skip('should preserve database contents in backup', async () => {
      // Use actual fs for this test
      const actualFs = await import('fs');
      
      const db = getDb();
      ensureSchema();
      
      db.exec(`INSERT INTO credentials (service, email, password) VALUES ('test', 'test@example.com', 'encrypted')`);
      db.close();
      
      // Ensure directory exists
      actualFs.mkdirSync(testDbDir, { recursive: true });
      
      // Create an actual file that backup can copy
      actualFs.writeFileSync(testDbPath, Buffer.from('SQLite format 3\0'));
      
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
});
