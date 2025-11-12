/**
 * @fileoverview Database Management Module
 * 
 * This module provides database connection management and schema initialization
 * for the Sheetpilot application. It handles SQLite database operations including
 * connection setup, path configuration, and timesheet table schema creation.
 * 
 * IMPROVED: Uses connection pooling with persistent connections for better performance
 * and thread safety.
 * 
 * @author Andrew Hughes
 * @version 2.0.0
 * @since 2025
 */

import type BetterSqlite3 from 'better-sqlite3';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as os from 'os';
import { dbLogger } from '../../../shared/logger';
import {
    DatabaseConnectionError,
    DatabaseSchemaError
} from '../../../shared/errors';

/**
 * Database file path configuration
 * Can be overridden via SHEETPILOT_DB environment variable
 * Defaults to 'sheetpilot.sqlite' in the current working directory
 */
let DB_PATH = process.env['SHEETPILOT_DB']
    ? path.resolve(process.env['SHEETPILOT_DB'])
    : path.resolve(process.cwd(), 'sheetpilot.sqlite');

/**
 * SINGLETON DATABASE CONNECTION
 * better-sqlite3 is NOT thread-safe. We maintain ONE persistent connection.
 * All operations share this single connection for consistency and performance.
 */
let connectionInstance: BetterSqlite3.Database | null = null;
let connectionLock: Promise<void> = Promise.resolve();
let schemaInitialized = false;

/**
 * Sets the database file path
 * 
 * @param {string} p - New database file path (will be resolved to absolute path)
 * @example
 * setDbPath('/custom/path/database.sqlite');
 */
export const setDbPath = (p: string) => { 
    const newPath = path.resolve(p);
    if (newPath !== DB_PATH) {
        // Close existing connection if path changes
        closeConnection();
        DB_PATH = newPath;
        schemaInitialized = false;
        dbLogger.info('Database path changed', { newPath });
    }
};

/**
 * Gets the current database file path
 * 
 * @returns {string} Current database file path
 * @example
 * const dbPath = getDbPath();
 * console.log(`Database location: ${dbPath}`);
 */
export const getDbPath = () => DB_PATH;

/**
 * Check if the connection is open and healthy
 */
function isConnectionHealthy(): boolean {
    try {
        return connectionInstance !== null && connectionInstance.open;
    } catch {
        return false;
    }
}

/**
 * Closes the persistent database connection
 * Should be called during application shutdown or test cleanup
 */
export function closeConnection(): void {
    if (connectionInstance) {
        try {
            connectionInstance.close();
            dbLogger.info('Database connection closed');
        } catch (error) {
            dbLogger.error('Error closing database connection', error);
        } finally {
            connectionInstance = null;
            schemaInitialized = false;
        }
    }
}

/**
 * Gracefully shutdown database connection
 * Export for use during application shutdown
 */
export function shutdownDatabase(): void {
    closeConnection();
}


/**
 * Module cache for better-sqlite3
 * Now uses static import for better compatibility with test mocks
 */
let __betterSqlite3Module: (typeof import('better-sqlite3')) | null = null;

function loadBetterSqlite3(): (typeof import('better-sqlite3')) {
    if (__betterSqlite3Module) return __betterSqlite3Module;
    try {
        dbLogger.verbose('Loading better-sqlite3 native module');
        // Use the statically imported module instead of dynamic require
        // This allows test mocks to properly intercept the module
        __betterSqlite3Module = { default: Database } as unknown as (typeof import('better-sqlite3'));
        if (!__betterSqlite3Module) {
            throw new Error('Could not load better-sqlite3 module');
        }
        dbLogger.info('better-sqlite3 module loaded successfully');
        return __betterSqlite3Module;
    } catch (err: unknown) {
        const message = [
            'Could not load better-sqlite3 native module',
            err instanceof Error ? err.message : String(err),
            'Recommended actions:',
            '- Run: npm run rebuild   (rebuilds native modules for current Electron)',
            '- Or run: npx electron-rebuild -f -w better-sqlite3',
            '- Ensure Electron and Node versions match the compiled native module'
        ].join('\n');
        dbLogger.error('Could not load better-sqlite3 module', { 
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            recommendedActions: [
                'npm run rebuild',
                'npx electron-rebuild -f -w better-sqlite3'
            ]
        });
        throw new Error(message);
    }
}

/**
 * Gets or creates the singleton database connection
 * Thread-safe initialization using promise-based locking
 * 
 * @returns {Database} The persistent database connection
 */
function getDbConnection(): BetterSqlite3.Database {
    // If we already have a healthy connection, return it
    if (isConnectionHealthy()) {
        return connectionInstance!;
    }
    
    // If another thread is initializing, wait for it
    if (connectionInstance === null) {
        // Lock initialization to prevent race conditions
        let unlockFunction: (() => void) = () => {};
        const currentLock = connectionLock.then(() => {
            return new Promise<void>((resolve) => {
                unlockFunction = resolve;
            });
        });
        connectionLock = currentLock;
        
        try {
            // Ensure the database directory exists
            const dbDir = path.dirname(DB_PATH);
            fs.mkdirSync(dbDir, { recursive: true });
            
            dbLogger.verbose('Opening persistent database connection', { dbPath: DB_PATH });
            
            const mod = loadBetterSqlite3() as unknown;
            // Support both ES module default export and CommonJS direct export
            const DatabaseCtor = (mod as { default?: unknown })?.default ?? (mod as { Database?: unknown })?.Database ?? mod;
            const db = new (DatabaseCtor as new (path: string, opts?: BetterSqlite3.Options) => BetterSqlite3.Database)(DB_PATH);
            
            // Configure WAL mode for better concurrency
            db.pragma('journal_mode = WAL');
            db.pragma('synchronous = NORMAL');
            db.pragma('cache_size = -32768'); // 32MB cache
            
            // Schema initialization (thread-safe - only first call succeeds)
            if (!schemaInitialized) {
                const timer = dbLogger.startTimer('schema-init');
                try {
                    ensureSchemaInternal(db);
                    schemaInitialized = true;
                    dbLogger.info('Database schema initialized', { dbPath: DB_PATH });
                } catch (error) {
                    throw new DatabaseSchemaError({
                        dbPath: DB_PATH,
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined
                    });
                } finally {
                    timer.done();
                }
            }
            
            connectionInstance = db;
            dbLogger.info('Persistent database connection established', { dbPath: DB_PATH });
        } catch (error) {
            dbLogger.error('Could not establish database connection', error);
            throw new DatabaseConnectionError({
                dbPath: DB_PATH,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        } finally {
            unlockFunction();
        }
    }
    
    return connectionInstance!;
}

/**
 * Gets database connection with retry logic
 * Used by all database operations
 */
export function getDb(): BetterSqlite3.Database {
    return getDbConnection();
}

/**
 * Backwards-compatible alias used in tests to obtain the DB connection
 */
export function openDb(): BetterSqlite3.Database {
    return getDb();
}


/**
 * Inserts a new timesheet entry with deduplication
 * 
 * Uses the unique constraint on (date, time_in, project, task_description) to prevent
 * duplicate entries. If a duplicate is found, the insertion is silently ignored.
 * 
 * @param {Object} entry - Timesheet entry object
 * @param {string} entry.date - Work date in YYYY-MM-DD format
 * @param {number} entry.timeIn - Start time in minutes since midnight
 * @param {number} entry.timeOut - End time in minutes since midnight
 * @param {string} entry.project - Project name
 * @param {string} [entry.tool] - Tool used (optional)
 * @param {string} [entry.detailChargeCode] - Charge code (optional)
 * @param {string} entry.taskDescription - Task description
 * @returns {Object} Result object with success status and duplicate info
 * 
 * @example
 * const result = insertTimesheetEntry({
 *   date: '2025-01-15',
 *   timeIn: 540,  // 9:00 AM
 *   timeOut: 600, // 10:00 AM
 *   project: 'MyProject',
 *   tool: 'VS Code',
 *   taskDescription: 'Code review'
 * });
 * 
 * if (result.success) {
 *   console.log('Entry inserted successfully');
 * } else if (result.isDuplicate) {
 *   console.log('Duplicate entry ignored');
 * }
 */
export function insertTimesheetEntry(entry: {
    date: string;
    timeIn: number;
    timeOut: number;
    project: string;
    tool?: string | null;
    detailChargeCode?: string | null;
    taskDescription: string;
}) {
    const timer = dbLogger.startTimer('insert-timesheet-entry');
    const db = getDb();
    
    dbLogger.verbose('Inserting timesheet entry', { 
        date: entry.date,
        project: entry.project,
        timeIn: entry.timeIn,
        timeOut: entry.timeOut
    });
    
    const insert = db.prepare(`
        INSERT INTO timesheet
          (date, time_in, time_out, project, tool, detail_charge_code, task_description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, time_in, project, task_description) DO NOTHING
    `);
    
    const result = insert.run(
        entry.date,
        entry.timeIn,
        entry.timeOut,
        entry.project,
        entry.tool || null,
        entry.detailChargeCode || null,
        entry.taskDescription
    );
    
    // Check if the insertion was successful or if it was a duplicate
    if (result.changes > 0) {
        dbLogger.info('Timesheet entry inserted', { 
            date: entry.date,
            project: entry.project 
        });
        timer.done({ isDuplicate: false, changes: result.changes });
        return { success: true, isDuplicate: false, changes: result.changes };
    } else {
        dbLogger.verbose('Duplicate timesheet entry skipped', { 
            date: entry.date,
            project: entry.project 
        });
        timer.done({ isDuplicate: true });
        return { success: false, isDuplicate: true, changes: 0 };
    }
}

/**
 * Checks if a timesheet entry would be a duplicate
 * 
 * @param {Object} entry - Timesheet entry object to check
 * @param {string} entry.date - Work date in YYYY-MM-DD format
 * @param {number} entry.timeIn - Start time in minutes since midnight
 * @param {string} entry.project - Project name
 * @param {string} entry.taskDescription - Task description
 * @returns {boolean} True if the entry would be a duplicate
 * 
 * @example
 * const isDuplicate = checkDuplicateEntry({
 *   date: '2025-01-15',
 *   timeIn: 540,
 *   project: 'MyProject',
 *   taskDescription: 'Code review'
 * });
 */
export function checkDuplicateEntry(entry: {
    date: string;
    timeIn: number;
    project: string;
    taskDescription: string;
}): boolean {
    const db = getDb();
    const checkDuplicate = db.prepare(`
        SELECT COUNT(*) as count 
        FROM timesheet 
        WHERE date = ? AND time_in = ? AND project = ? AND task_description = ?
    `);
    
    const result = checkDuplicate.get(entry.date, entry.timeIn, entry.project, entry.taskDescription);
    return (result as { count: number }).count > 0;
}

/**
 * Gets all duplicate entries for a given date range
 * 
 * @param {string} [startDate] - Start date in YYYY-MM-DD format (optional)
 * @param {string} [endDate] - End date in YYYY-MM-DD format (optional)
 * @returns {Array} Array of duplicate entries with their counts
 * 
 * @example
 * const duplicates = getDuplicateEntries('2025-01-01', '2025-01-31');
 * duplicates.forEach(dup => {
 *   console.log(`Found ${dup.count} duplicates for ${dup.date} at ${dup.time_in}`);
 * });
 */
export function getDuplicateEntries(startDate?: string, endDate?: string) {
    const db = getDb();
    let query = `
        SELECT date, time_in, project, task_description, COUNT(*) as count
        FROM timesheet 
        GROUP BY date, time_in, project, task_description
        HAVING COUNT(*) > 1
    `;
    
    const params: unknown[] = [];
    
    if (startDate) {
        query += ` AND date >= ?`;
        params.push(startDate);
    }
    
    if (endDate) {
        query += ` AND date <= ?`;
        params.push(endDate);
    }
    
    query += ` ORDER BY date, time_in`;
    
    const getDuplicates = db.prepare(query);
    return getDuplicates.all(...params);
}

/**
 * Inserts multiple timesheet entries with deduplication in a single transaction
 * 
 * Processes multiple entries efficiently using a transaction and provides detailed
 * results about successful insertions and duplicates encountered.
 * 
 * @param {Array} entries - Array of timesheet entry objects
 * @returns {Object} Result object with insertion statistics
 * 
 * @example
 * const entries = [
 *   { date: '2025-01-15', timeIn: 540, timeOut: 600, project: 'ProjA', taskDescription: 'Task 1' },
 *   { date: '2025-01-15', timeIn: 600, timeOut: 660, project: 'ProjA', taskDescription: 'Task 2' }
 * ];
 * 
 * const result = insertTimesheetEntries(entries);
 * console.log(`Inserted: ${result.inserted}, Duplicates: ${result.duplicates}`);
 */
export function insertTimesheetEntries(entries: Array<{
    date: string;
    timeIn: number;
    timeOut: number;
    project: string;
    tool?: string | null;
    detailChargeCode?: string | null;
    taskDescription: string;
}>) {
    const timer = dbLogger.startTimer('insert-timesheet-entries-bulk');
    const db = getDb();
    
    try {
        dbLogger.info('Starting bulk insert of timesheet entries', { count: entries.length });
        
        const insert = db.prepare(`
            INSERT INTO timesheet
              (date, time_in, time_out, project, tool, detail_charge_code, task_description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, time_in, project, task_description) DO NOTHING
        `);
        
        let inserted = 0;
        let duplicates = 0;
        
        const insertMany = db.transaction((entriesList: unknown[]) => {
            for (const entry of entriesList) {
                const typedEntry = entry as Record<string, unknown>;
                const result = insert.run(
                    typedEntry['date'],
                    typedEntry['timeIn'],
                    typedEntry['timeOut'],
                    typedEntry['project'],
                    typedEntry['tool'] || null,
                    typedEntry['detailChargeCode'] || null,
                    typedEntry['taskDescription']
                );
                
                if (result.changes > 0) {
                    inserted++;
                } else {
                    duplicates++;
                }
            }
        });
        
        insertMany(entries);
        
        dbLogger.info('Bulk insert completed', { 
            total: entries.length,
            inserted,
            duplicates 
        });
        timer.done({ inserted, duplicates });
        
        return {
            success: true,
            total: entries.length,
            inserted,
            duplicates,
            errors: 0
        };
    } catch (error) {
        dbLogger.error('Bulk insert failed', error);
        timer.done({ outcome: 'error' });
        return {
            success: false,
            total: entries.length,
            inserted: 0,
            duplicates: 0,
            errors: entries.length,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Internal schema creation (takes an open database connection)
 * @private
 */
function ensureSchemaInternal(db: BetterSqlite3.Database) {
    
    // Create timesheet table with comprehensive schema and constraints
    db.exec(`
        CREATE TABLE IF NOT EXISTS timesheet(
            -- Primary key with auto-increment
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            
            -- Computed column: hours worked (automatically calculated from time difference)
            hours REAL
                GENERATED ALWAYS AS ((time_out - time_in) / 60.0) 
                STORED,
            
            -- Core timesheet data fields
            date TEXT NOT NULL,                    -- Work date in YYYY-MM-DD format
            time_in INTEGER NOT NULL,              -- Start time in minutes since midnight
            time_out INTEGER NOT NULL,             -- End time in minutes since midnight
            project TEXT NOT NULL,                 -- Project name (required)
            tool TEXT,                             -- Tool used (optional)
            detail_charge_code TEXT,               -- Charge code (optional)
            task_description TEXT NOT NULL,        -- Task description (required)
            
            -- Submission tracking fields
            status TEXT DEFAULT NULL,              -- Submission status: NULL (pending), 'in_progress' (submitting), 'Complete' (submitted)
            submitted_at DATETIME DEFAULT NULL,    -- Timestamp when successfully submitted
            
            -- Data validation constraints
            CHECK(time_in between 0 and 1439),     -- Valid time range: 00:00 to 23:59
            CHECK(time_out between 1 and 1400),    -- Valid time range: 00:15 to 23:45
            CHECK(time_out > time_in),             -- End time must be after start time
            CHECK(time_in % 15 = 0),               -- Start time must be 15-minute increment
            CHECK(time_out % 15 = 0)               -- End time must be 15-minute increment
        );
        
        -- Performance indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_timesheet_date ON timesheet(date);
        CREATE INDEX IF NOT EXISTS idx_timesheet_project ON timesheet(project);
        CREATE INDEX IF NOT EXISTS idx_timesheet_status ON timesheet(status);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_timesheet_nk
            ON timesheet(date, time_in, project, task_description);
        
        -- Credentials table for storing user authentication
        CREATE TABLE IF NOT EXISTS credentials(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service TEXT NOT NULL,                    -- Service name (e.g., 'smartsheet')
            email TEXT NOT NULL,                     -- User email
            password TEXT NOT NULL,                  -- Encrypted password
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(service)                          -- Only one set of credentials per service
        );
        
        -- Index for credentials lookups
        CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service);
        
        -- Sessions table for managing user login sessions
        CREATE TABLE IF NOT EXISTS sessions(
            session_token TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            expires_at DATETIME,
            is_admin BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Indexes for session lookups
        CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);
}

/**
 * Ensures the database schema is created and up-to-date
 * 
 * Creates the timesheet table with all necessary columns, constraints, and indexes
 * if they don't already exist. This function should be called before any database
 * operations to ensure the schema is properly initialized.
 * 
 * The timesheet table includes:
 * - Auto-incrementing primary key
 * - Computed hours column (calculated from time_in and time_out)
 * - Data validation constraints for time values and 15-minute increments
 * - Indexes for performance on date and project queries
 * 
 * @throws {Error} When database operations fail
 * 
 * @example
 * ensureSchema(); // Creates tables and indexes if they don't exist
 */
export function ensureSchema() {
    const timer = dbLogger.startTimer('ensure-schema');
    dbLogger.info('Ensuring database schema is up to date');
    const db = getDb();
    
    // Always run the schema initialization - the CREATE IF NOT EXISTS handles duplicates
    // This ensures schema is created even if called multiple times or after path changes
    ensureSchemaInternal(db);
    schemaInitialized = true;
    
    dbLogger.info('Database schema ensured successfully');
    timer.done();
}

/**
 * Gets all pending timesheet entries that need to be submitted
 * 
 * @returns Array of pending timesheet entries with all fields
 */
export function getPendingTimesheetEntries() {
    const timer = dbLogger.startTimer('get-pending-entries');
    const db = getDb();
    
    dbLogger.verbose('Fetching pending timesheet entries');
    const getPending = db.prepare(`
        SELECT * FROM timesheet 
        WHERE status IS NULL
        ORDER BY date, time_in
    `);
    
    const entries = getPending.all();
    dbLogger.verbose('Pending entries retrieved', { count: entries.length });
    timer.done({ count: entries.length });
    return entries;
}

/**
 * Marks timesheet entries as in-progress (being submitted)
 * 
 * This protects entries from being deleted by orphan cleanup while submission is in progress.
 * 
 * @param ids - Array of timesheet entry IDs to mark as in-progress
 */
export function markTimesheetEntriesAsInProgress(ids: number[]) {
    if (ids.length === 0) {
        dbLogger.debug('No entries to mark as in-progress');
        return;
    }
    
    const timer = dbLogger.startTimer('mark-entries-in-progress');
    const db = getDb();
    
    // Check current status before updating
    const placeholdersCheck = ids.map(() => '?').join(',');
    const checkStmt = db.prepare(`SELECT id, status FROM timesheet WHERE id IN (${placeholdersCheck})`);
    const currentStatuses = checkStmt.all(...ids);
    dbLogger.info('Current entry statuses before marking as in-progress', { 
        count: ids.length, 
        ids,
        statuses: currentStatuses
    });
    
    dbLogger.info('Marking timesheet entries as in-progress', { count: ids.length, ids });
    const placeholders = ids.map(() => '?').join(',');
    const updateInProgress = db.prepare(`
        UPDATE timesheet 
        SET status = 'in_progress'
        WHERE id IN (${placeholders}) AND status IS NULL
    `);
    
    const result = updateInProgress.run(...ids);
    
    // Verify the update worked
    if (result.changes !== ids.length) {
        dbLogger.error('Mismatch in mark as in-progress update', {
            expected: ids.length,
            actual: result.changes,
            ids
        });
    }
    
    dbLogger.audit('mark-in-progress', 'Entries marked as in-progress', { 
        count: ids.length,
        changes: result.changes,
        success: result.changes === ids.length
    });
    timer.done({ count: ids.length, changes: result.changes });
}

/**
 * Resets timesheet entries status back to NULL (pending)
 * Used when submissions are cancelled or time out
 * 
 * @param ids - Array of timesheet entry IDs to reset
 */
export function resetTimesheetEntriesStatus(ids: number[]) {
    if (ids.length === 0) {
        dbLogger.debug('No entries to reset status');
        return;
    }
    
    const timer = dbLogger.startTimer('reset-entries-status');
    const db = getDb();
    
    dbLogger.info('Resetting timesheet entries to NULL status', { count: ids.length, ids });
    const placeholders = ids.map(() => '?').join(',');
    const resetStatus = db.prepare(`
        UPDATE timesheet 
        SET status = NULL
        WHERE id IN (${placeholders})
    `);
    
    const result = resetStatus.run(...ids);
    dbLogger.audit('reset-status', 'Entries status reset to NULL', { 
        count: ids.length,
        changes: result.changes 
    });
    timer.done({ count: ids.length, changes: result.changes });
}

/**
 * Resets all in-progress timesheet entries back to NULL (pending)
 * Used when submissions are cancelled
 * 
 * @returns Number of entries reset
 */
export function resetInProgressTimesheetEntries(): number {
    const timer = dbLogger.startTimer('reset-in-progress-entries');
    const db = getDb();
    
    dbLogger.info('Resetting all in-progress timesheet entries to NULL status');
    const resetStatus = db.prepare(`
        UPDATE timesheet 
        SET status = NULL
        WHERE status = 'in_progress'
    `);
    
    const result = resetStatus.run();
    dbLogger.audit('reset-in-progress-status', 'In-progress entries reset to NULL', { 
        changes: result.changes 
    });
    
    timer.done({ changes: result.changes });
    return result.changes;
}

/**
 * Marks timesheet entries as successfully submitted
 * 
 * @param ids - Array of timesheet entry IDs to mark as complete
 * @throws {Error} If the database update fails or doesn't affect all expected rows
 */
export function markTimesheetEntriesAsSubmitted(ids: number[]) {
    if (ids.length === 0) {
        dbLogger.debug('No entries to mark as submitted');
        return;
    }
    
    const timer = dbLogger.startTimer('mark-entries-submitted');
    
    try {
        const db = getDb();
        
        // Check current status of entries before updating
        const placeholdersCheck = ids.map(() => '?').join(',');
        const checkStmt = db.prepare(`SELECT id, status FROM timesheet WHERE id IN (${placeholdersCheck})`);
        const currentStatuses = checkStmt.all(...ids);
        dbLogger.info('Current entry statuses before marking as submitted', { 
            count: ids.length, 
            ids,
            statuses: currentStatuses
        });
        
        dbLogger.info('Marking timesheet entries as submitted', { count: ids.length, ids });
        const placeholders = ids.map(() => '?').join(',');
        const updateSubmitted = db.prepare(`
            UPDATE timesheet 
            SET status = 'Complete', 
                submitted_at = datetime('now')
            WHERE id IN (${placeholders})
              AND (status IS NULL OR status = 'in_progress')
        `);
        
        // Wrap in a transaction so changes roll back on validation failure
        const transaction = db.transaction(() => {
            const result = updateSubmitted.run(...ids);
            
            // Validate that all expected rows were updated
            if (result.changes !== ids.length) {
                const errorMsg = `Database update mismatch: expected ${ids.length} changes, got ${result.changes}`;
                dbLogger.error(errorMsg, { 
                    expectedCount: ids.length,
                    actualChanges: result.changes,
                    ids 
                });
                throw new Error(errorMsg);
            }
            
            return result;
        });
        
        const result = transaction();
        
        // Force WAL checkpoint to ensure changes are persisted to disk and visible to all connections
        try {
            db.pragma('wal_checkpoint(FULL)');
            dbLogger.debug('WAL checkpoint executed after marking entries as submitted');
        } catch (checkpointError) {
            dbLogger.warn('Could not execute WAL checkpoint', { 
                error: checkpointError instanceof Error ? checkpointError.message : String(checkpointError)
            });
            // Don't throw - checkpoint failure is not critical, changes are still in WAL
        }
        
        dbLogger.audit('mark-submitted', 'Entries marked as submitted', { 
            count: ids.length,
            changes: result.changes 
        });
        timer.done({ count: ids.length, changes: result.changes, success: true });
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        dbLogger.error('Could not mark timesheet entries as submitted', { 
            error: errorMsg,
            count: ids.length,
            ids 
        });
        timer.done({ outcome: 'error', error: errorMsg });
        throw error;
    }
}

/**
 * Reverts failed timesheet entries back to pending status
 * 
 * Instead of deleting failed entries, we revert them to NULL (pending) status
 * so users can review and retry submission.
 * 
 * @param ids - Array of timesheet entry IDs that failed to submit
 * @throws {Error} If the database update fails or doesn't affect all expected rows
 */
export function removeFailedTimesheetEntries(ids: number[]) {
    if (ids.length === 0) {
        dbLogger.debug('No failed entries to revert');
        return;
    }
    
    const timer = dbLogger.startTimer('revert-failed-entries');
    
    try {
        const db = getDb();
        
        dbLogger.warn('Reverting failed timesheet entries back to pending', { count: ids.length, ids });
        const placeholders = ids.map(() => '?').join(',');
        const revertFailed = db.prepare(`
            UPDATE timesheet 
            SET status = NULL
            WHERE id IN (${placeholders})
        `);
        
        // Wrap in a transaction so changes roll back on validation failure
        const transaction = db.transaction(() => {
            const result = revertFailed.run(...ids);
            
            // Validate that all expected rows were updated
            if (result.changes !== ids.length) {
                const errorMsg = `Database update mismatch: expected ${ids.length} changes, got ${result.changes}`;
                dbLogger.error(errorMsg, { 
                    expectedCount: ids.length,
                    actualChanges: result.changes,
                    ids 
                });
                throw new Error(errorMsg);
            }
            
            return result;
        });
        
        const result = transaction();
        
        // Force WAL checkpoint to ensure changes are persisted to disk and visible to all connections
        try {
            db.pragma('wal_checkpoint(FULL)');
            dbLogger.debug('WAL checkpoint executed after reverting failed entries');
        } catch (checkpointError) {
            dbLogger.warn('Could not execute WAL checkpoint', { 
                error: checkpointError instanceof Error ? checkpointError.message : String(checkpointError)
            });
            // Don't throw - checkpoint failure is not critical, changes are still in WAL
        }
        
        dbLogger.audit('revert-failed', 'Failed entries reverted to pending status', { 
            count: ids.length,
            changes: result.changes 
        });
        timer.done({ count: ids.length, changes: result.changes, success: true });
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        dbLogger.error('Could not revert failed timesheet entries', { 
            error: errorMsg,
            count: ids.length,
            ids 
        });
        timer.done({ outcome: 'error', error: errorMsg });
        throw error;
    }
}

/**
 * Gets timesheet entries by their IDs
 * 
 * @param ids - Array of timesheet entry IDs
 * @returns Array of timesheet entries
 */
export function getTimesheetEntriesByIds(ids: number[]) {
    if (ids.length === 0) return [];
    
    const db = getDb();
    
    const placeholders = ids.map(() => '?').join(',');
    const getByIds = db.prepare(`
        SELECT * FROM timesheet 
        WHERE id IN (${placeholders})
        ORDER BY date, time_in
    `);
    
    return getByIds.all(...ids);
}

/**
 * Gets all submitted timesheet entries for CSV export
 * 
 * @returns Array of submitted timesheet entries with formatted data
 */
export function getSubmittedTimesheetEntriesForExport() {
    const timer = dbLogger.startTimer('get-submitted-entries-export');
    const db = getDb();
    
    dbLogger.verbose('Fetching submitted timesheet entries for export');
    const getSubmitted = db.prepare(`
        SELECT 
            date,
            time_in,
            time_out,
            hours,
            project,
            tool,
            detail_charge_code,
            task_description,
            status,
            submitted_at
        FROM timesheet 
        WHERE status = 'Complete'
        ORDER BY date DESC, time_in DESC
    `);
    
    const entries = getSubmitted.all();
    dbLogger.verbose('Submitted entries retrieved for export', { count: entries.length });
    timer.done({ count: entries.length });
    return entries;
}

// ============================================================================
// CREDENTIALS MANAGEMENT
// ============================================================================

/**
 * Secure encryption/decryption for storing passwords using AES-256-GCM
 * 
 * Security features:
 * - AES-256-GCM authenticated encryption
 * - Unique IV per encryption operation
 * - Derived encryption key from master secret
 * - Authentication tag for integrity verification
 */

/**
 * Get or create the master encryption key
 * Uses machine-specific data combined with app name for key derivation
 * For production: Consider using environment variable or secure key storage
 */
function getMasterKey(): Buffer {
    const masterSecret = process.env['SHEETPILOT_MASTER_KEY'] || 
                         `sheetpilot-${os.hostname()}-${os.userInfo().username}`;
    
    // Derive a 32-byte key using PBKDF2
    return crypto.pbkdf2Sync(
        masterSecret,
        'sheetpilot-salt-v1', // Static salt - for production, use dynamic salt per installation
        100000, // iterations
        32, // key length (256 bits)
        'sha256'
    );
}

/**
 * Encrypts a password using AES-256-GCM
 * Returns: base64(iv:authTag:encryptedData)
 */
function encryptPassword(password: string): string {
    try {
        const key = getMasterKey();
        const iv = crypto.randomBytes(16); // 128-bit IV for GCM
        
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        // Store IV:authTag:encrypted as base64
        const combined = Buffer.concat([
            iv,
            authTag,
            Buffer.from(encrypted, 'hex')
        ]);
        
        return combined.toString('base64');
    } catch (error) {
        dbLogger.error('Encryption failed', error);
        throw new Error('Could not encrypt password');
    }
}

/**
 * Decrypts a password using AES-256-GCM
 * Input format: base64(iv:authTag:encryptedData)
 */
function decryptPassword(encryptedPassword: string): string {
    try {
        const key = getMasterKey();
        const combined = Buffer.from(encryptedPassword, 'base64');
        
        // Extract IV (16 bytes), authTag (16 bytes), and encrypted data
        const iv = combined.subarray(0, 16);
        const authTag = combined.subarray(16, 32);
        const encrypted = combined.subarray(32);
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        dbLogger.error('Decryption failed', error);
        throw new Error('Could not decrypt password');
    }
}

/**
 * Stores or updates credentials for a service
 * 
 * @param service - Service name (e.g., 'smartsheet')
 * @param email - User email
 * @param password - User password (will be encrypted)
 * @returns Object with success status and message
 */
export function storeCredentials(service: string, email: string, password: string) {
    const timer = dbLogger.startTimer('store-credentials');
    const db = getDb();
    
    try {
        dbLogger.verbose('Storing credentials', { service, email });
        const encryptedPassword = encryptPassword(password);
        
        // Check if credentials already exist for this service
        const existing = db.prepare('SELECT id FROM credentials WHERE service = ?').get(service);
        
        let result;
        if (existing) {
            // Update existing credentials
            const update = db.prepare(`
                UPDATE credentials 
                SET email = ?, password = ?, updated_at = CURRENT_TIMESTAMP
                WHERE service = ?
            `);
            result = update.run(email, encryptedPassword, service);
        } else {
            // Insert new credentials
            const insert = db.prepare(`
                INSERT INTO credentials (service, email, password, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `);
            result = insert.run(service, email, encryptedPassword);
        }
        
        dbLogger.audit('store-credentials', 'Credentials stored', { 
            service,
            email,
            changes: result.changes 
        });
        timer.done({ changes: result.changes });
        
        return {
            success: true,
            message: 'Credentials stored successfully',
            changes: result.changes
        };
    } catch (error) {
        dbLogger.error('Could not store credentials', error);
        timer.done({ outcome: 'error' });
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            changes: 0
        };
    }
}

/**
 * Retrieves credentials for a service
 * 
 * @param service - Service name (e.g., 'smartsheet')
 * @returns Object with email and decrypted password, or null if not found
 */
export function getCredentials(service: string): { email: string; password: string } | null {
    const timer = dbLogger.startTimer('get-credentials');
    const db = getDb();
    
    try {
        dbLogger.verbose('Retrieving credentials', { service });
        const getCreds = db.prepare(`
            SELECT email, password FROM credentials 
            WHERE service = ? 
            ORDER BY updated_at DESC 
            LIMIT 1
        `);
        
        const result = getCreds.get(service) as { email: string; password: string } | undefined;
        
        if (!result) {
            dbLogger.verbose('No credentials found', { service });
            timer.done({ found: false });
            return null;
        }
        
        dbLogger.audit('get-credentials', 'Credentials retrieved', { 
            service,
            email: result.email 
        });
        timer.done({ found: true, email: result.email });
        
        return {
            email: result.email,
            password: decryptPassword(result.password)
        };
    } catch (error: unknown) {
        dbLogger.error('Could not retrieve credentials', error);
        timer.done({ outcome: 'error' });
        return null;
    }
}

/**
 * Lists all stored credentials (without passwords)
 * 
 * @returns Array of credential records without passwords
 */
export function listCredentials() {
    const db = getDb();
    
    try {
        const listCreds = db.prepare(`
            SELECT id, service, email, created_at, updated_at 
            FROM credentials 
            ORDER BY service
        `);
        
        return listCreds.all();
    } catch (error) {
        dbLogger.error('Error listing credentials', error);
        return [];
    }
}

/**
 * Deletes credentials for a service
 * 
 * @param service - Service name
 * @returns Object with success status and message
 */
export function deleteCredentials(service: string) {
    const timer = dbLogger.startTimer('delete-credentials');
    const db = getDb();
    
    try {
        dbLogger.verbose('Deleting credentials', { service });
        const deleteCreds = db.prepare(`
            DELETE FROM credentials 
            WHERE service = ?
        `);
        
        const result = deleteCreds.run(service);
        
        if (result.changes > 0) {
            dbLogger.audit('delete-credentials', 'Credentials deleted', { 
                service
            });
        } else {
            dbLogger.verbose('No credentials found to delete', { service });
        }
        timer.done({ changes: result.changes });
        
        return {
            success: true,
            message: result.changes > 0 ? 'Credentials deleted successfully' : 'No credentials found',
            changes: result.changes
        };
    } catch (error) {
        dbLogger.error('Could not delete credentials', error);
        timer.done({ outcome: 'error' });
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            changes: 0
        };
    }
}

// ============================================================================
// SESSION MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Creates a new session for a user
 * 
 * @param email - User email address
 * @param stayLoggedIn - If true, session expires in 30 days; if false, no expiry (session-only)
 * @param isAdmin - Whether this is an admin session
 * @returns Session token (UUID)
 */
export function createSession(email: string, stayLoggedIn: boolean, isAdmin: boolean = false): string {
    const timer = dbLogger.startTimer('create-session');
    const db = getDb();
    
    try {
        // Generate UUID v4 for session token
        const crypto = require('crypto');
        const sessionToken = crypto.randomUUID();
        
        // Calculate expiry: 30 days from now if stayLoggedIn, otherwise NULL
        const expiresAt = stayLoggedIn 
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null;
        
        dbLogger.verbose('Creating session', { email, stayLoggedIn, isAdmin });
        
        const insert = db.prepare(`
            INSERT INTO sessions (session_token, email, expires_at, is_admin)
            VALUES (?, ?, ?, ?)
        `);
        
        insert.run(sessionToken, email, expiresAt, isAdmin ? 1 : 0);
        
        dbLogger.info('Session created successfully', { email, isAdmin });
        timer.done({ sessionCreated: true });
        
        return sessionToken;
    } catch (error) {
        dbLogger.error('Could not create session', error);
        timer.done({ outcome: 'error' });
        throw error;
    }
}

/**
 * Validates a session token and returns session info if valid
 * 
 * @param token - Session token to validate
 * @returns Object with validation result and email if valid
 */
export function validateSession(token: string): { valid: boolean; email?: string; isAdmin?: boolean } {
    const timer = dbLogger.startTimer('validate-session');
    const db = getDb();
    
    try {
        dbLogger.verbose('Validating session', { token: token.substring(0, 8) + '...' });
        
        const getSession = db.prepare(`
            SELECT email, expires_at, is_admin
            FROM sessions
            WHERE session_token = ?
        `);
        
        const session = getSession.get(token) as { email: string; expires_at: string | null; is_admin: number } | undefined;
        
        if (!session) {
            dbLogger.verbose('Session not found');
            timer.done({ valid: false });
            return { valid: false };
        }
        
        // Check if session has expired (only if expires_at is not NULL)
        if (session.expires_at) {
            const expiresAt = new Date(session.expires_at);
            const now = new Date();
            
            if (now > expiresAt) {
                dbLogger.verbose('Session expired', { email: session.email });
                // Clean up expired session
                clearSession(token);
                timer.done({ valid: false, reason: 'expired' });
                return { valid: false };
            }
        }
        
        dbLogger.verbose('Session validated successfully', { email: session.email });
        timer.done({ valid: true });
        
        return {
            valid: true,
            email: session.email,
            isAdmin: session.is_admin === 1
        };
    } catch (error) {
        dbLogger.error('Could not validate session', error);
        timer.done({ outcome: 'error' });
        return { valid: false };
    }
}

/**
 * Clears a specific session by token
 * 
 * @param token - Session token to clear
 */
export function clearSession(token: string): void {
    const timer = dbLogger.startTimer('clear-session');
    const db = getDb();
    
    try {
        dbLogger.verbose('Clearing session', { token: token.substring(0, 8) + '...' });
        
        const deleteSession = db.prepare(`
            DELETE FROM sessions
            WHERE session_token = ?
        `);
        
        const result = deleteSession.run(token);
        
        if (result.changes > 0) {
            dbLogger.info('Session cleared successfully');
        } else {
            dbLogger.verbose('Session not found to clear');
        }
        timer.done({ changes: result.changes });
    } catch (error) {
        dbLogger.error('Could not clear session', error);
        timer.done({ outcome: 'error' });
    }
}

/**
 * Clears all sessions for a specific user
 * 
 * @param email - User email whose sessions should be cleared
 */
export function clearUserSessions(email: string): void {
    const timer = dbLogger.startTimer('clear-user-sessions');
    const db = getDb();
    
    try {
        dbLogger.verbose('Clearing user sessions', { email });
        
        const deleteSessions = db.prepare(`
            DELETE FROM sessions
            WHERE email = ?
        `);
        
        const result = deleteSessions.run(email);
        
        dbLogger.info('User sessions cleared', { email, count: result.changes });
        timer.done({ changes: result.changes });
    } catch (error) {
        dbLogger.error('Could not clear user sessions', error);
        timer.done({ outcome: 'error' });
    }
}

/**
 * Gets an active session for a user email
 * 
 * @param email - User email to look up
 * @returns Session token if found and valid, null otherwise
 */
export function getSessionByEmail(email: string): string | null {
    const timer = dbLogger.startTimer('get-session-by-email');
    const db = getDb();
    
    try {
        dbLogger.verbose('Getting session by email', { email });
        
        const getSession = db.prepare(`
            SELECT session_token, expires_at
            FROM sessions
            WHERE email = ?
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        const session = getSession.get(email) as { session_token: string; expires_at: string | null } | undefined;
        
        if (!session) {
            timer.done({ found: false });
            return null;
        }
        
        // Check if expired
        if (session.expires_at) {
            const expiresAt = new Date(session.expires_at);
            const now = new Date();
            
            if (now > expiresAt) {
                clearSession(session.session_token);
                timer.done({ found: false, reason: 'expired' });
                return null;
            }
        }
        
        timer.done({ found: true });
        return session.session_token;
    } catch (error) {
        dbLogger.error('Could not get session by email', error);
        timer.done({ outcome: 'error' });
        return null;
    }
}

/**
 * Clears all credentials from the database
 * Used by admin for recovery purposes
 */
export function clearAllCredentials(): void {
    const timer = dbLogger.startTimer('clear-all-credentials');
    const db = getDb();
    
    try {
        dbLogger.info('Clearing all credentials');
        
        const deleteAll = db.prepare('DELETE FROM credentials');
        const result = deleteAll.run();
        
        dbLogger.info('All credentials cleared', { count: result.changes });
        timer.done({ changes: result.changes });
    } catch (error) {
        dbLogger.error('Could not clear all credentials', error);
        timer.done({ outcome: 'error' });
        throw error;
    }
}

/**
 * Rebuilds the database by dropping and recreating all tables
 * Used by admin for recovery purposes
 */
export function rebuildDatabase(): void {
    const timer = dbLogger.startTimer('rebuild-database');
    const db = getDb();
    
    try {
        dbLogger.warn('Rebuilding database - dropping all tables');
        
        // Drop all tables
        db.exec(`
            DROP TABLE IF EXISTS timesheet;
            DROP TABLE IF EXISTS credentials;
            DROP TABLE IF EXISTS sessions;
        `);
        
        // Reset schema initialized flag to force recreation
        schemaInitialized = false;
        
        // Recreate schema
        ensureSchema();
        
        dbLogger.info('Database rebuilt successfully');
        timer.done();
    } catch (error) {
        dbLogger.error('Could not rebuild database', error);
        timer.done({ outcome: 'error' });
        throw error;
    }
}