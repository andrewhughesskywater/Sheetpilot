import type BetterSqlite3 from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { dbLogger } from "@sheetpilot/shared/logger";
import { migrations } from "./migrations.definitions";

export const CURRENT_SCHEMA_VERSION = 4;

export function getCurrentSchemaVersion(db: BetterSqlite3.Database): number {
  try {
    // Check if schema_info table exists
    const tableExists = db
      .prepare(
        `
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='schema_info'
        `
      )
      .get();

    if (!tableExists) {
      dbLogger.verbose("schema_info table does not exist, returning version 0");
      return 0;
    }

    // Get the current version
    const result = db
      .prepare("SELECT version FROM schema_info WHERE id = 1")
      .get() as { version: number } | undefined;

    if (!result) {
      dbLogger.verbose("No version record in schema_info, returning version 0");
      return 0;
    }

    dbLogger.verbose("Current schema version retrieved", {
      version: result.version,
    });
    return result.version;
  } catch (error) {
    dbLogger.warn("Could not get schema version, assuming version 0", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Sets the schema version in the database
 *
 * @param db - Database connection
 * @param version - Version number to set
 */
export function setSchemaVersion(
  db: BetterSqlite3.Database,
  version: number
): void {
  // Use INSERT OR REPLACE to handle both initial insert and updates
  const stmt = db.prepare(`
        INSERT OR REPLACE INTO schema_info (id, version, updated_at)
        VALUES (1, ?, datetime('now'))
    `);
  stmt.run(version);
  dbLogger.info("Schema version updated", { version });
}

/**
 * Creates a backup of the database file before migration
 *
 * @param dbPath - Path to the database file
 * @returns Path to the backup file, or null if backup failed
 */
export function createBackup(dbPath: string): string | null {
  const timer = dbLogger.startTimer("create-db-backup");

  try {
    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      dbLogger.verbose("Database file does not exist, skipping backup", {
        dbPath,
      });
      timer.done({ skipped: true, reason: "file-not-exists" });
      return null;
    }

    // Generate backup filename with timestamp
    const timestamp = Date.now();
    const dir = path.dirname(dbPath);
    const basename = path.basename(dbPath, ".sqlite");
    const backupPath = path.join(dir, `${basename}.backup-${timestamp}.sqlite`);

    dbLogger.info("Creating database backup before migration", {
      source: dbPath,
      backup: backupPath,
    });

    // Copy the database file
    fs.copyFileSync(dbPath, backupPath);

    // Also backup WAL and SHM files if they exist (for WAL mode databases)
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;

    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, `${backupPath}-wal`);
      dbLogger.verbose("WAL file backed up", { walPath });
    }

    if (fs.existsSync(shmPath)) {
      fs.copyFileSync(shmPath, `${backupPath}-shm`);
      dbLogger.verbose("SHM file backed up", { shmPath });
    }

    dbLogger.info("Database backup created successfully", { backupPath });
    timer.done({ backupPath });

    return backupPath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    dbLogger.error("Could not create database backup", {
      dbPath,
      error: errorMessage,
    });
    timer.done({ outcome: "error", error: errorMessage });
    return null;
  }
}

/**
 * Runs all pending migrations to bring the database to the current schema version
 * Creates a backup before running any migrations
 *
 * @param db - Database connection
 * @param dbPath - Path to the database file (for backup)
 * @returns Object with migration result details
 */
export function runMigrations(
  db: BetterSqlite3.Database,
  dbPath: string
): {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  migrationsRun: number;
  backupPath: string | null;
  error?: string;
} {
  const timer = dbLogger.startTimer("run-migrations");
  const currentVersion = getCurrentSchemaVersion(db);
  const targetVersion = CURRENT_SCHEMA_VERSION;

  dbLogger.info("Checking database schema version", {
    currentVersion,
    targetVersion,
    needsMigration: currentVersion < targetVersion,
  });

  // If already at target version, no migration needed
  if (currentVersion >= targetVersion) {
    dbLogger.verbose("Database schema is up to date, no migration needed");
    timer.done({ migrationsRun: 0 });
    return {
      success: true,
      fromVersion: currentVersion,
      toVersion: currentVersion,
      migrationsRun: 0,
      backupPath: null,
    };
  }

  // Create backup before migration
  let backupPath: string | null = null;
  if (currentVersion > 0) {
    // Only backup if there's existing data (version > 0)
    backupPath = createBackup(dbPath);
    if (!backupPath && fs.existsSync(dbPath)) {
      // Backup failed but database exists - this is a safety concern
      const error =
        "Could not create backup before migration. Migration aborted for safety.";
      dbLogger.error(error, { dbPath });
      timer.done({ outcome: "error", error });
      return {
        success: false,
        fromVersion: currentVersion,
        toVersion: currentVersion,
        migrationsRun: 0,
        backupPath: null,
        error,
      };
    }
  }

  // Run migrations in a transaction
  let migrationsRun = 0;

  try {
    // Get migrations that need to run (versions > currentVersion and <= targetVersion)
    const pendingMigrations = migrations
      .filter((m) => m.version > currentVersion && m.version <= targetVersion)
      .sort((a, b) => a.version - b.version);

    if (pendingMigrations.length === 0) {
      // No migrations to run but version is behind - just update version
      // This can happen if schema was created manually
      dbLogger.info("No pending migrations, updating version tracking");
      setSchemaVersion(db, targetVersion);
      timer.done({ migrationsRun: 0, versionUpdated: true });
      return {
        success: true,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        migrationsRun: 0,
        backupPath,
      };
    }

    dbLogger.info("Running database migrations", {
      count: pendingMigrations.length,
      versions: pendingMigrations.map((m) => m.version),
    });

    // Run each migration in its own transaction for atomic rollback
    for (const migration of pendingMigrations) {
      dbLogger.info("Running migration", {
        version: migration.version,
        description: migration.description,
      });

      const migrationTransaction = db.transaction(() => {
        migration.up(db);
        setSchemaVersion(db, migration.version);
      });

      migrationTransaction();
      migrationsRun++;

      dbLogger.info("Migration completed successfully", {
        version: migration.version,
      });
    }

    dbLogger.info("All migrations completed successfully", {
      fromVersion: currentVersion,
      toVersion: targetVersion,
      migrationsRun,
      backupPath,
    });

    timer.done({
      fromVersion: currentVersion,
      toVersion: targetVersion,
      migrationsRun,
    });

    return {
      success: true,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      migrationsRun,
      backupPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    dbLogger.error("Migration failed", {
      fromVersion: currentVersion,
      targetVersion,
      migrationsRun,
      error: errorMessage,
      backupPath,
    });

    timer.done({ outcome: "error", error: errorMessage, migrationsRun });

    return {
      success: false,
      fromVersion: currentVersion,
      toVersion: currentVersion + migrationsRun,
      migrationsRun,
      backupPath,
      error: `Migration failed: ${errorMessage}. Database backup available at: ${backupPath || "N/A"}`,
    };
  }
}

/**
 * Checks if the database needs migration
 *
 * @param db - Database connection
 * @returns true if migration is needed
 */
export function needsMigration(db: BetterSqlite3.Database): boolean {
  const currentVersion = getCurrentSchemaVersion(db);
  return currentVersion < CURRENT_SCHEMA_VERSION;
}
