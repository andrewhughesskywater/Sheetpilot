import * as path from "path";
import type { App } from "electron";
import type BetterSqlite3 from "better-sqlite3";
import type { LoggerLike } from "@/bootstrap/logging/logger-contract";
import {
  ensureSchema,
  getDb,
  getDbPath,
  runMigrations,
  setDbPath,
} from "@/models";

export function bootstrapDatabase(app: App, logger: LoggerLike): void {
  const timer = logger.startTimer("bootstrap-database");
  const dbFile = path.join(app.getPath("userData"), "sheetpilot.sqlite");
  logger.verbose("Setting database path", { dbFile });
  setDbPath(dbFile);

  // Run migrations before ensuring schema (handles version tracking and backups)
  logger.verbose("Running database migrations if needed");
  const db = getDb(); // This will initialize schema if needed
  const migrationResult = runMigrations(db, getDbPath());
  if (!migrationResult.success) {
    logger.error("Database migration failed", {
      error: migrationResult.error,
      backupPath: migrationResult.backupPath,
    });
    // Continue anyway - ensureSchema will handle basic table creation
  } else if (migrationResult.migrationsRun > 0) {
    logger.info("Database migrations completed", {
      fromVersion: migrationResult.fromVersion,
      toVersion: migrationResult.toVersion,
      migrationsRun: migrationResult.migrationsRun,
      backupPath: migrationResult.backupPath,
    });
  }

  // Safety check: Always verify hours column is not generated (fix if needed)
  // This runs AFTER migrations as a safety net, even if migrations already ran
  // This ensures users on version 1 or 2 get the fix when they upgrade
  fixGeneratedHoursColumnSafetyCheck(db, logger);

  logger.verbose("Ensuring database schema exists");
  ensureSchema();
  logger.info("Database initialized successfully", { dbPath: getDbPath() });
  timer.done();
}

/**
 * Safety check: Fixes generated hours column if it exists
 * This runs after migrations to catch any cases where the migration didn't fix it
 * This is especially important for users upgrading from version 1 or 2
 */
function fixGeneratedHoursColumnSafetyCheck(
  db: BetterSqlite3.Database,
  logger: LoggerLike
): void {
  try {
    const createTableStmt = db
      .prepare(
        `
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='timesheet'
    `
      )
      .get() as { sql: string } | undefined;

    if (!createTableStmt) {
      return; // Table doesn't exist yet
    }

    const sql = createTableStmt.sql || "";
    const isGeneratedInSql = /\bhours\b[\s\S]*?\bGENERATED\s+ALWAYS/i.test(sql);

    // Try INSERT test (most reliable)
    let isGeneratedByTest = false;
    if (!isGeneratedInSql) {
      try {
        db.exec("SAVEPOINT fix_hours_safety_check");
        const testStmt = db.prepare(`
          INSERT INTO timesheet (date, hours, project, task_description)
          VALUES ('2000-01-01', 1.0, 'test', 'test')
        `);
        testStmt.run();
        db.exec("ROLLBACK TO fix_hours_safety_check");
        db.exec("RELEASE fix_hours_safety_check");
      } catch (error) {
        try {
          db.exec("ROLLBACK TO fix_hours_safety_check");
          db.exec("RELEASE fix_hours_safety_check");
        } catch {
          // Ignore rollback errors
        }
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (
          errorMsg.includes("generated column") ||
          errorMsg.includes("cannot INSERT into")
        ) {
          isGeneratedByTest = true;
        }
      }
    }

    if (isGeneratedInSql || isGeneratedByTest) {
      logger.warn(
        "Safety check: Detected generated hours column, fixing it now",
        {
          detectedBySql: isGeneratedInSql,
          detectedByTest: isGeneratedByTest,
        }
      );

      // Create temporary table with correct schema
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

      // Migrate data
      db.exec(`
        INSERT INTO timesheet_new 
        (id, hours, date, project, tool, detail_charge_code, task_description, status, submitted_at)
        SELECT 
          id, hours, date, project, tool, detail_charge_code, task_description, status, submitted_at
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

      logger.info("Safety check: Fixed generated hours column successfully");
    }
  } catch (error) {
    // Don't fail database initialization if this check fails
    logger.warn("Safety check: Could not verify/fix hours column", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
