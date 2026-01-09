/**
 * @fileoverview Database Migration System
 * 
 * Handles automatic schema migrations with backup and data preservation.
 * Migrations run at app startup before the main window loads.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import BetterSqlite3 from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { dbLogger } from './utils/logger';
import { ensureSchemaInternal } from './connection-manager';

/**
 * Current schema version - increment when adding new migrations
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Migration definition interface
 */
interface Migration {
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
const migrations: Migration[] = [
    {
        version: 1,
        description: 'Initial schema - creates all base tables',
        up: (db: BetterSqlite3.Database) => {
            // Version 1 is the initial schema
            // Uses ensureSchemaInternal which creates tables if they don't exist
            ensureSchemaInternal(db);
        }
    },
    {
        version: 2,
        description: 'Add metadata column to schema_info table for extensibility',
        up: (db: BetterSqlite3.Database) => {
            // Add optional metadata column to store migration notes, timestamps, or other info
            // This demonstrates the migration system and provides extension point for future use
            db.exec('ALTER TABLE schema_info ADD COLUMN metadata TEXT DEFAULT NULL');
            dbLogger.info('Migration v2: Added metadata column to schema_info table');
        }
    }
    // Future migrations added here:
    // {
    //     version: 3,
    //     description: 'Add new_column to timesheet table',
    //     up: (db) => {
    //         db.exec('ALTER TABLE timesheet ADD COLUMN new_column TEXT');
    //     }
    // }
];

/**
 * Gets the current schema version from the database
 * Returns 0 if schema_info table doesn't exist or has no version record
 * 
 * @param db - Database connection
 * @returns Current schema version number
 */
export function getCurrentSchemaVersion(db: BetterSqlite3.Database): number {
    try {
        // Check if schema_info table exists
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='schema_info'
        `).get();
        
        if (!tableExists) {
            dbLogger.verbose('schema_info table does not exist, returning version 0');
            return 0;
        }
        
        // Get the current version
        const result = db.prepare('SELECT version FROM schema_info WHERE id = 1').get() as { version: number } | undefined;
        
        if (!result) {
            dbLogger.verbose('No version record in schema_info, returning version 0');
            return 0;
        }
        
        dbLogger.verbose('Current schema version retrieved', { version: result.version });
        return result.version;
    } catch (error) {
        dbLogger.warn('Could not get schema version, assuming version 0', {
            error: error instanceof Error ? error.message : String(error)
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
export function setSchemaVersion(db: BetterSqlite3.Database, version: number): void {
    // Use INSERT OR REPLACE to handle both initial insert and updates
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO schema_info (id, version, updated_at)
        VALUES (1, ?, datetime('now'))
    `);
    stmt.run(version);
    dbLogger.info('Schema version updated', { version });
}

function tryCheckpointWal(db: BetterSqlite3.Database): void {
    try {
        // Force a full checkpoint to move all WAL data to main database
        // This works even if not in WAL mode (no-op)
        db.pragma('wal_checkpoint(TRUNCATE)');
        dbLogger.verbose('WAL checkpoint completed before backup');
    } catch (checkpointError) {
        // If checkpoint fails, log but continue - might not be in WAL mode
        dbLogger.verbose('WAL checkpoint failed or not needed', {
            error: checkpointError instanceof Error ? checkpointError.message : String(checkpointError)
        });
    }
}

function touchDatabaseConnection(db: BetterSqlite3.Database): void {
    try {
        db.prepare('SELECT COUNT(*) FROM sqlite_master').get();
    } catch {
        // Ignore - just ensuring connection is active
    }
}

function createBackupPath(dbPath: string): string {
    const timestamp = Date.now();
    const dir = path.dirname(dbPath);
    const basename = path.basename(dbPath, '.sqlite');
    return path.join(dir, `${basename}.backup-${timestamp}.sqlite`);
}

function tryVacuumInto(db: BetterSqlite3.Database, backupPath: string): { ok: boolean; error?: string } {
    try {
        // Escape single quotes in the path by doubling them (SQL standard)
        // Convert Windows backslashes to forward slashes for SQLite
        const normalizedPath = backupPath.replace(/\\/g, '/');
        const escapedPath = normalizedPath.replace(/'/g, "''");
        db.exec(`VACUUM INTO '${escapedPath}'`);
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

type SqliteSchemaObject = { type: string; name: string; sql: string };

function safeDeleteFileIfExists(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch {
        // ignore
    }
}

function listUserSchemaObjects(db: BetterSqlite3.Database): SqliteSchemaObject[] {
    return db
        .prepare(
            `
                SELECT type, name, sql
                FROM sqlite_master
                WHERE name NOT LIKE 'sqlite_%'
                  AND sql IS NOT NULL
                ORDER BY CASE type
                    WHEN 'table' THEN 0
                    WHEN 'view' THEN 1
                    WHEN 'index' THEN 2
                    WHEN 'trigger' THEN 3
                    ELSE 4
                END
            `
        )
        .all() as SqliteSchemaObject[];
}

function createTablesAndViews(backupDb: BetterSqlite3.Database, objects: SqliteSchemaObject[]): void {
    for (const obj of objects) {
        if (obj.type === 'table' || obj.type === 'view') {
            backupDb.exec(obj.sql);
        }
    }
}

function createIndexesAndTriggers(backupDb: BetterSqlite3.Database, objects: SqliteSchemaObject[]): void {
    for (const obj of objects) {
        if (obj.type === 'index' || obj.type === 'trigger') {
            backupDb.exec(obj.sql);
        }
    }
}

function listTableNames(objects: SqliteSchemaObject[]): string[] {
    return objects.filter(o => o.type === 'table').map(o => o.name);
}

function getTableColumns(db: BetterSqlite3.Database, tableName: string): Array<{ name: string }> {
    const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;
    return db.prepare(`PRAGMA table_info(${quoteIdent(tableName)})`).all() as Array<{ name: string }>;
}

function insertAllRows(
    sourceDb: BetterSqlite3.Database,
    backupDb: BetterSqlite3.Database,
    tableName: string,
    columnNames: string[]
): void {
    const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

    const insertSql = `INSERT INTO ${quoteIdent(tableName)} (${columnNames.map(quoteIdent).join(', ')}) VALUES (${columnNames.map(c => `@${c}`).join(', ')})`;
    const insertStmt = backupDb.prepare(insertSql);

    const rows = sourceDb.prepare(`SELECT * FROM ${quoteIdent(tableName)}`).all() as Array<Record<string, unknown>>;
    for (const row of rows) {
        insertStmt.run(row);
    }
}

function copyTableContents(
    sourceDb: BetterSqlite3.Database,
    backupDb: BetterSqlite3.Database,
    tableNames: string[]
): void {
    for (const tableName of tableNames) {
        const columns = getTableColumns(sourceDb, tableName);
        if (columns.length === 0) continue;

        insertAllRows(sourceDb, backupDb, tableName, columns.map(c => c.name));
    }
}

function rollbackQuietly(db: BetterSqlite3.Database): void {
    try {
        db.exec('ROLLBACK');
    } catch {
        // ignore
    }
}

function copyBackupFromOpenConnection(db: BetterSqlite3.Database, backupPath: string): void {
    safeDeleteFileIfExists(backupPath);

    const backupDb = new BetterSqlite3(backupPath);
    try {
        backupDb.pragma('journal_mode = OFF');
        backupDb.exec('BEGIN');

        const objects = listUserSchemaObjects(db);
        createTablesAndViews(backupDb, objects);
        copyTableContents(db, backupDb, listTableNames(objects));
        createIndexesAndTriggers(backupDb, objects);

        backupDb.exec('COMMIT');
    } catch (copyError) {
        rollbackQuietly(backupDb);
        throw copyError;
    } finally {
        backupDb.close();
    }
}

/**
 * Creates a backup of the database file before migration
 * 
 * @param db - Database connection (used to checkpoint WAL mode databases)
 * @param dbPath - Path to the database file
 * @returns Path to the backup file, or null if backup failed
 */
export function createBackup(db: BetterSqlite3.Database, dbPath: string): string | null {
    const timer = dbLogger.startTimer('create-db-backup');
    
    try {
        tryCheckpointWal(db);
        touchDatabaseConnection(db);

        // If the database file doesn't exist yet (common with WAL mode + small DBs),
        // we still want a backup before migrating. We can create one from the open
        // connection by copying schema + data into a new backup database.
        let sourceFileMissing = false;
        try {
            const stats = fs.statSync(dbPath);
            if (!stats.isFile()) {
                dbLogger.verbose('Database path is not a file, skipping backup', { dbPath });
                timer.done({ outcome: 'skipped', reason: 'db-path-not-file' });
                return null;
            }
        } catch {
            sourceFileMissing = true;
            dbLogger.verbose('Database file does not exist on disk; will create backup from open connection', { dbPath });
        }
        
        const backupPath = createBackupPath(dbPath);
        
        dbLogger.info('Creating database backup before migration', { 
            source: dbPath, 
            backup: backupPath 
        });

        if (sourceFileMissing) {
            copyBackupFromOpenConnection(db, backupPath);
        } else {
            // Prefer SQLite's VACUUM INTO (SQLite 3.27.0+) for a consistent backup.
            // Some environments/bundled SQLite builds may not support it; fall back to
            // copying schema + data from the open connection.
            const vacuumResult = tryVacuumInto(db, backupPath);
            if (!vacuumResult.ok) {
                dbLogger.warn('VACUUM INTO backup failed; falling back to SQL copy', {
                    dbPath,
                    backupPath,
                    error: vacuumResult.error ?? 'VACUUM INTO failed'
                });
                copyBackupFromOpenConnection(db, backupPath);
            }
        }
        
        // Verify backup was created
        if (!fs.existsSync(backupPath)) {
            throw new Error(`Backup file was not created at ${backupPath}`);
        }
        
        dbLogger.verbose('Database backup completed');
        
        dbLogger.info('Database backup created successfully', { backupPath });
        timer.done({ backupPath });
        
        return backupPath;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        dbLogger.error('Could not create database backup', { 
            dbPath, 
            error: errorMessage 
        });
        timer.done({ outcome: 'error', error: errorMessage });
        return null;
    }
}

type MigrationRunResult = {
    success: boolean;
    fromVersion: number;
    toVersion: number;
    migrationsRun: number;
    backupPath: string | null;
    error?: string;
};

function buildUpToDateMigrationResult(version: number): MigrationRunResult {
    return {
        success: true,
        fromVersion: version,
        toVersion: version,
        migrationsRun: 0,
        backupPath: null
    };
}

function buildBackupSafetyAbortMigrationResult(version: number, error: string): MigrationRunResult {
    return {
        success: false,
        fromVersion: version,
        toVersion: version,
        migrationsRun: 0,
        backupPath: null,
        error
    };
}

function buildNoPendingMigrationsResult(
    currentVersion: number,
    targetVersion: number,
    backupPath: string | null
): MigrationRunResult {
    return {
        success: true,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        migrationsRun: 0,
        backupPath
    };
}

function buildMigrationSuccessResult(
    currentVersion: number,
    targetVersion: number,
    migrationsRun: number,
    backupPath: string | null
): MigrationRunResult {
    return {
        success: true,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        migrationsRun,
        backupPath
    };
}

function buildMigrationFailureResult(
    currentVersion: number,
    migrationsRun: number,
    backupPath: string | null,
    errorMessage: string
): MigrationRunResult {
    return {
        success: false,
        fromVersion: currentVersion,
        toVersion: currentVersion + migrationsRun,
        migrationsRun,
        backupPath,
        error: `Migration failed: ${errorMessage}. Database backup available at: ${backupPath || 'N/A'}`
    };
}

function getPendingMigrations(currentVersion: number, targetVersion: number): Migration[] {
    return migrations
        .filter(m => m.version > currentVersion && m.version <= targetVersion)
        .sort((a, b) => a.version - b.version);
}

function runPendingMigrations(db: BetterSqlite3.Database, pendingMigrations: Migration[]): number {
    let migrationsRun = 0;
    for (const migration of pendingMigrations) {
        dbLogger.info('Running migration', {
            version: migration.version,
            description: migration.description
        });

        const migrationTransaction = db.transaction(() => {
            migration.up(db);
            setSchemaVersion(db, migration.version);
        });

        migrationTransaction();
        migrationsRun++;

        dbLogger.info('Migration completed successfully', {
            version: migration.version
        });
    }

    return migrationsRun;
}

/**
 * Runs all pending migrations to bring the database to the current schema version
 * Creates a backup before running any migrations
 * 
 * @param db - Database connection
 * @param dbPath - Path to the database file (for backup)
 * @returns Object with migration result details
 */
export function runMigrations(db: BetterSqlite3.Database, dbPath: string): {
    success: boolean;
    fromVersion: number;
    toVersion: number;
    migrationsRun: number;
    backupPath: string | null;
    error?: string;
} {
    const timer = dbLogger.startTimer('run-migrations');
    const currentVersion = getCurrentSchemaVersion(db);
    const targetVersion = CURRENT_SCHEMA_VERSION;

    dbLogger.info('Checking database schema version', {
        currentVersion,
        targetVersion,
        needsMigration: currentVersion < targetVersion
    });

    if (currentVersion >= targetVersion) {
        dbLogger.verbose('Database schema is up to date, no migration needed');
        timer.done({ migrationsRun: 0 });
        return buildUpToDateMigrationResult(currentVersion);
    }

    let backupPath: string | null = null;
    if (currentVersion > 0) {
        backupPath = createBackup(db, dbPath);
        if (!backupPath && fs.existsSync(dbPath)) {
            const error = 'Could not create backup before migration. Migration aborted for safety.';
            dbLogger.error(error, { dbPath });
            timer.done({ outcome: 'error', error });
            return buildBackupSafetyAbortMigrationResult(currentVersion, error);
        }
    }

    let migrationsRun = 0;
    try {
        const pendingMigrations = getPendingMigrations(currentVersion, targetVersion);
        if (pendingMigrations.length === 0) {
            dbLogger.info('No pending migrations, updating version tracking');
            setSchemaVersion(db, targetVersion);
            timer.done({ migrationsRun: 0, versionUpdated: true });
            return buildNoPendingMigrationsResult(currentVersion, targetVersion, backupPath);
        }

        dbLogger.info('Running database migrations', {
            count: pendingMigrations.length,
            versions: pendingMigrations.map(m => m.version)
        });

        migrationsRun = runPendingMigrations(db, pendingMigrations);

        dbLogger.info('All migrations completed successfully', {
            fromVersion: currentVersion,
            toVersion: targetVersion,
            migrationsRun,
            backupPath
        });

        timer.done({
            fromVersion: currentVersion,
            toVersion: targetVersion,
            migrationsRun
        });

        return buildMigrationSuccessResult(currentVersion, targetVersion, migrationsRun, backupPath);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        dbLogger.error('Migration failed', {
            fromVersion: currentVersion,
            targetVersion,
            migrationsRun,
            error: errorMessage,
            backupPath
        });

        timer.done({ outcome: 'error', error: errorMessage, migrationsRun });
        return buildMigrationFailureResult(currentVersion, migrationsRun, backupPath, errorMessage);
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
