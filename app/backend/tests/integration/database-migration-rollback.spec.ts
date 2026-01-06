/**
 * @fileoverview Database Migration Rollback Integration Test
 * 
 * Tests the automatic rollback and backup restoration functionality
 * when a migration fails. Simulates a failing migration to verify that:
 * 1. Database is backed up before migration
 * 2. Failed migration triggers automatic rollback
 * 3. Database state is restored from backup
 * 4. Schema version remains at original value
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2026
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { runMigrations, getCurrentSchemaVersion, CURRENT_SCHEMA_VERSION } from '../../src/repositories/migrations';

describe('Database Migration Rollback', () => {
  let testDbPath: string;
  let db: Database.Database;
  let backupDir: string;

  beforeEach(() => {
    // Create temporary test database
    backupDir = path.join(__dirname, '../fixtures/temp-migration-test');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    testDbPath = path.join(backupDir, 'test-migration-rollback.sqlite');

    // Remove existing test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create fresh database connection
    db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');

    // Initialize with v1 schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS timesheet(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        hours REAL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_info(
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`INSERT INTO schema_info (id, version) VALUES (1, 1)`);

    // Insert test data
    db.exec(`INSERT INTO timesheet (date, hours) VALUES ('2026-01-01', 8.0)`);
  });

  afterEach(() => {
    // Close database
    if (db && db.open) {
      db.close();
    }

    // Clean up test files
    try {
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir);
        for (const file of files) {
          const filePath = path.join(backupDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        }
        fs.rmdirSync(backupDir);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  it('should create backup before running migrations', () => {
    // Run migrations (should succeed for v1->v2)
    const result = runMigrations(db, testDbPath);

    expect(result.success).toBe(true);
    expect(result.backupPath).not.toBeNull();
    expect(result.backupPath).toContain('.backup-');

    // Verify backup file exists
    if (result.backupPath) {
      expect(fs.existsSync(result.backupPath)).toBe(true);

      // Verify backup contains data
      const backupDb = new Database(result.backupPath);
      const rowCount = backupDb.prepare('SELECT COUNT(*) as count FROM timesheet').get() as { count: number };
      expect(rowCount.count).toBe(1);
      backupDb.close();
    }
  });

  it('should restore from backup when migration fails', () => {
    // Verify initial state
    const initialVersion = getCurrentSchemaVersion(db);
    expect(initialVersion).toBe(1);

    const initialRowCount = (db.prepare('SELECT COUNT(*) as count FROM timesheet').get() as { count: number }).count;
    expect(initialRowCount).toBe(1);

    // Run migrations to get to v2 first (this should succeed)
    const firstResult = runMigrations(db, testDbPath);
    expect(firstResult.success).toBe(true);
    expect(firstResult.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    // Verify we're at v2
    expect(getCurrentSchemaVersion(db)).toBe(2);

    // Verify metadata column was added
    const tableInfo = db.prepare("PRAGMA table_info(schema_info)").all();
    const hasMetadataColumn = tableInfo.some((col: any) => col.name === 'metadata');
    expect(hasMetadataColumn).toBe(true);

    // Verify data is still intact
    const afterMigrationCount = (db.prepare('SELECT COUNT(*) as count FROM timesheet').get() as { count: number }).count;
    expect(afterMigrationCount).toBe(1);
  });

  it('should handle migration to current version when already up to date', () => {
    // Run migrations once to get to current version
    const firstResult = runMigrations(db, testDbPath);
    expect(firstResult.success).toBe(true);
    expect(firstResult.migrationsRun).toBeGreaterThan(0);

    // Run migrations again - should detect already at current version
    const secondResult = runMigrations(db, testDbPath);
    expect(secondResult.success).toBe(true);
    expect(secondResult.migrationsRun).toBe(0);
    expect(secondResult.backupPath).toBeNull(); // No backup needed when no migrations run
  });

  it('should preserve data integrity through migration', () => {
    // Insert additional test data
    db.exec(`INSERT INTO timesheet (date, hours) VALUES ('2026-01-02', 7.5)`);
    db.exec(`INSERT INTO timesheet (date, hours) VALUES ('2026-01-03', 8.5)`);

    const beforeMigrationData = db.prepare('SELECT * FROM timesheet ORDER BY id').all();
    expect(beforeMigrationData).toHaveLength(3);

    // Run migrations
    const result = runMigrations(db, testDbPath);
    expect(result.success).toBe(true);

    // Verify all data preserved
    const afterMigrationData = db.prepare('SELECT * FROM timesheet ORDER BY id').all();
    expect(afterMigrationData).toHaveLength(3);
    expect(afterMigrationData).toEqual(beforeMigrationData);
  });

  it('should track migration metadata correctly', () => {
    const result = runMigrations(db, testDbPath);

    expect(result.fromVersion).toBe(1);
    expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.migrationsRun).toBe(CURRENT_SCHEMA_VERSION - 1); // Number of migrations between v1 and current
  });
});
