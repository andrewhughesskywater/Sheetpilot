/**
 * @fileoverview Migration Definitions
 *
 * Individual migration definitions for database schema evolution.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type BetterSqlite3 from "better-sqlite3";
import { dbLogger } from "@sheetpilot/shared/logger";
import { ensureSchemaInternal } from "./connection-manager";
import {
  isHoursColumnGenerated,
  createTimesheetTableWithSchema,
  migrateTimesheetData,
  replaceTimesheetTableAndIndexes,
  createBusinessConfigTables,
  seedBusinessConfigFromStatic,
} from "./migrations.helpers";

/**
 * Migration definition interface
 */
export interface Migration {
  /** Target version after this migration runs */
  version: number;
  /** Description of what this migration does */
  description: string;
  /** Migration function - transforms schema from version-1 to version */
  up: (db: BetterSqlite3.Database) => void;
}

/**
 * Migration definitions array
 * Each migration transforms the schema from version N-1 to version N
 * Migrations are run in order from current version to target version
 */
export const migrations: Migration[] = [
  {
    version: 1,
    description: "Initial schema - creates all base tables",
    up: (db: BetterSqlite3.Database) => {
      // Version 1 is the initial schema
      // Uses ensureSchemaInternal which creates tables if they don't exist
      ensureSchemaInternal(db);
    },
  },
  {
    version: 2,
    description: "Migrate from time_in/time_out to hours-only system",
    up: (db: BetterSqlite3.Database) => {
      // Check if migration needed (check for time_in column)
      const tableInfo = db
        .prepare("PRAGMA table_info(timesheet)")
        .all() as Array<{ name: string }>;
      const hasTimeIn = tableInfo.some((col) => col.name === "time_in");

      if (!hasTimeIn) {
        dbLogger.verbose("Migration 2: Schema already migrated, skipping");
        return; // Already migrated
      }

      dbLogger.info("Migration 2: Starting timesheet schema migration");

      // Create temporary table with new schema
      db.exec(`
                CREATE TABLE timesheet_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    hours REAL CHECK(hours IS NULL OR (hours >= 0.25 AND hours <= 24.0 AND (hours * 4) % 1 = 0)),
                    date TEXT,
                    project TEXT,
                    tool TEXT,
                    detail_charge_code TEXT,
                    task_description TEXT,
                    status TEXT DEFAULT NULL,
                    submitted_at DATETIME DEFAULT NULL
                )
            `);

      // Migrate data: calculate hours from time_in/time_out
      db.exec(`
                INSERT INTO timesheet_new 
                (id, hours, date, project, tool, detail_charge_code, task_description, status, submitted_at)
                SELECT 
                    id,
                    CASE 
                        WHEN time_in IS NOT NULL AND time_out IS NOT NULL 
                        THEN (time_out - time_in) / 60.0
                        ELSE NULL
                    END as hours,
                    date,
                    project,
                    tool,
                    detail_charge_code,
                    task_description,
                    status,
                    submitted_at
                FROM timesheet
            `);

      // Drop old table and rename new one
      db.exec(`DROP TABLE timesheet`);
      db.exec(`ALTER TABLE timesheet_new RENAME TO timesheet`);

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

      dbLogger.info("Migration 2: Timesheet schema migration completed");
    },
  },
  {
    version: 3,
    description: "Fix hours column if it was created as a generated column",
    up: (db: BetterSqlite3.Database) => {
      // This migration ALWAYS checks and fixes the issue, even if run multiple times
      // This ensures the fix is applied even if the database version was incorrectly set
      // Check if timesheet table exists
      const createTableStmt = db
        .prepare(
          `
                SELECT sql FROM sqlite_master 
                WHERE type='table' AND name='timesheet'
            `
        )
        .get() as { sql: string } | undefined;

      if (!createTableStmt) {
        dbLogger.verbose(
          "Migration 3: timesheet table does not exist, skipping"
        );
        return;
      }

      // Check if hours is a generated column using multiple methods:
      // 1. Check CREATE TABLE statement for GENERATED keyword (case-insensitive, flexible whitespace)
      const sql = createTableStmt.sql || "";
      const isGenerated = isHoursColumnGenerated(db, sql);

      if (!isGenerated) {
        dbLogger.verbose(
          "Migration 3: hours column is not generated, skipping"
        );
        return; // Already correct
      }

      dbLogger.info(
        "Migration 3: Fixing hours column (converting from generated to regular column)"
      );

      // Create temporary table with correct schema (hours as regular column)
      createTimesheetTableWithSchema(db);

      // Migrate data: copy all columns including hours (it will be computed if it was generated)
      migrateTimesheetData(db);

      // Drop old table and rename new one
      replaceTimesheetTableAndIndexes(db);

      dbLogger.info("Migration 3: Hours column fixed successfully");
    },
  },
  {
    version: 4,
    description: "Create business configuration tables and seed from static config",
    up: (db: BetterSqlite3.Database) => {
      dbLogger.info("Migration 4: Starting business configuration migration");

      // Create tables
      createBusinessConfigTables(db);

      // Seed data from static config
      seedBusinessConfigFromStatic(db);

      dbLogger.info("Migration 4: Business configuration migration completed");
    },
  },
];
