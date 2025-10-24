/**
 * @fileoverview Database Management Module
 * 
 * This module provides database connection management and schema initialization
 * for the Sheetpilot application. It handles SQLite database operations including
 * connection setup, path configuration, and timesheet table schema creation.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { dbLogger } from '../shared/logger';

/**
 * Database file path configuration
 * Can be overridden via SHEETPILOT_DB environment variable
 * Defaults to 'sheetpilot.sqlite' in the current working directory
 */
let DB_PATH = process.env['SHEETPILOT_DB']
    ? path.resolve(process.env['SHEETPILOT_DB'])
    : path.resolve(process.cwd(), 'sheetpilot.sqlite');

/**
 * Track whether database schema has been ensured
 * Allows lazy initialization on first use
 */
let schemaEnsured = false;

/**
 * Sets the database file path
 * 
 * @param {string} p - New database file path (will be resolved to absolute path)
 * @example
 * setDbPath('/custom/path/database.sqlite');
 */
export const setDbPath = (p: string) => { 
    DB_PATH = path.resolve(p); 
    // Reset schema flag when path changes so schema gets created for new database
    schemaEnsured = false;
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
 * Opens a connection to the SQLite database
 * 
 * Creates the database directory if it doesn't exist and returns a new
 * Database instance. The database file will be created automatically
 * if it doesn't exist.
 * 
 * @param {Database.Options} [opts] - Optional database connection options
 * @returns {Database} SQLite database connection instance
 * @throws {Error} When the database directory cannot be created or database cannot be opened
 * 
 * @example
 * const db = openDb();
 * const result = db.prepare('SELECT * FROM timesheet').all();
 * db.close();
 */
let __betterSqlite3Module: (typeof import('better-sqlite3')) | null = null;

function loadBetterSqlite3(): (typeof import('better-sqlite3')) {
    if (__betterSqlite3Module) return __betterSqlite3Module;
    try {
        dbLogger.verbose('Loading better-sqlite3 native module');
        __betterSqlite3Module = require('better-sqlite3');
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

export function openDb(opts?: BetterSqlite3.Options): BetterSqlite3.Database {
    // Ensure the database directory exists before creating the connection
    const dbDir = path.dirname(DB_PATH);
    fs.mkdirSync(dbDir, { recursive: true });
    
    dbLogger.verbose('Opening database connection', { dbPath: DB_PATH, options: opts });
    const mod = loadBetterSqlite3() as unknown;
    const DatabaseCtor = (mod as { default?: unknown })?.default ?? mod;
    const db = new (DatabaseCtor as new (path: string, opts?: BetterSqlite3.Options) => BetterSqlite3.Database)(DB_PATH, opts);
    
    // Lazy initialization: ensure schema on first database open
    if (!schemaEnsured) {
        const timer = dbLogger.startTimer('lazy-schema-init');
        try {
            dbLogger.info('Ensuring database schema (lazy init)');
            ensureSchemaInternal(db);
            schemaEnsured = true;
            dbLogger.info('Database initialized successfully (lazy init)', { dbPath: DB_PATH });
            timer.done();
        } catch (error) {
            dbLogger.error('Lazy database initialization failed', error);
            timer.done({ outcome: 'error' });
            throw error;
        }
    } else {
        dbLogger.debug('Database connection established (schema already ensured)');
    }
    
    return db;
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
    tool?: string;
    detailChargeCode?: string;
    taskDescription: string;
}) {
    const timer = dbLogger.startTimer('insert-timesheet-entry');
    const db = openDb();
    
    try {
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
    } finally {
        db.close();
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
    const db = openDb();
    
    try {
        const checkDuplicate = db.prepare(`
            SELECT COUNT(*) as count 
            FROM timesheet 
            WHERE date = ? AND time_in = ? AND project = ? AND task_description = ?
        `);
        
        const result = checkDuplicate.get(entry.date, entry.timeIn, entry.project, entry.taskDescription);
        return (result as { count: number }).count > 0;
    } finally {
        db.close();
    }
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
    const db = openDb();
    
    try {
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
    } finally {
        db.close();
    }
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
    tool?: string;
    detailChargeCode?: string;
    taskDescription: string;
}>) {
    const timer = dbLogger.startTimer('insert-timesheet-entries-bulk');
    const db = openDb();
    
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
    } finally {
        db.close();
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
            status TEXT DEFAULT NULL,              -- Submission status: 'Complete', NULL (pending)
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
    if (schemaEnsured) {
        dbLogger.debug('Schema already ensured, skipping');
        return;
    }
    
    const timer = dbLogger.startTimer('ensure-schema');
    dbLogger.info('Ensuring database schema is up to date');
    const db = openDb();
    
    ensureSchemaInternal(db);
    schemaEnsured = true;
    
    dbLogger.info('Database schema ensured successfully');
    timer.done();
    db.close();
}

/**
 * Gets all pending timesheet entries that need to be submitted
 * 
 * @returns Array of pending timesheet entries with all fields
 */
export function getPendingTimesheetEntries() {
    const timer = dbLogger.startTimer('get-pending-entries');
    const db = openDb();
    
    try {
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
    } finally {
        db.close();
    }
}

/**
 * Marks timesheet entries as successfully submitted
 * 
 * @param ids - Array of timesheet entry IDs to mark as complete
 */
export function markTimesheetEntriesAsSubmitted(ids: number[]) {
    if (ids.length === 0) {
        dbLogger.debug('No entries to mark as submitted');
        return;
    }
    
    const timer = dbLogger.startTimer('mark-entries-submitted');
    const db = openDb();
    
    try {
        dbLogger.info('Marking timesheet entries as submitted', { count: ids.length, ids });
        const placeholders = ids.map(() => '?').join(',');
        const updateSubmitted = db.prepare(`
            UPDATE timesheet 
            SET status = 'Complete', 
                submitted_at = datetime('now')
            WHERE id IN (${placeholders})
        `);
        
        const result = updateSubmitted.run(...ids);
        dbLogger.audit('mark-submitted', 'Entries marked as submitted', { 
            count: ids.length,
            changes: result.changes 
        });
        timer.done({ count: ids.length, changes: result.changes });
    } finally {
        db.close();
    }
}

/**
 * Removes failed timesheet entries from the database
 * 
 * Since users cannot manually modify the database, failed entries are removed
 * rather than marked as errors.
 * 
 * @param ids - Array of timesheet entry IDs to remove
 */
export function removeFailedTimesheetEntries(ids: number[]) {
    if (ids.length === 0) {
        dbLogger.debug('No failed entries to remove');
        return;
    }
    
    const timer = dbLogger.startTimer('remove-failed-entries');
    const db = openDb();
    
    try {
        dbLogger.warn('Removing failed timesheet entries', { count: ids.length, ids });
        const placeholders = ids.map(() => '?').join(',');
        const deleteFailed = db.prepare(`
            DELETE FROM timesheet 
            WHERE id IN (${placeholders})
        `);
        
        const result = deleteFailed.run(...ids);
        dbLogger.audit('remove-failed', 'Failed entries removed from database', { 
            count: ids.length,
            changes: result.changes 
        });
        timer.done({ count: ids.length, changes: result.changes });
    } finally {
        db.close();
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
    
    const db = openDb();
    
    try {
        const placeholders = ids.map(() => '?').join(',');
        const getByIds = db.prepare(`
            SELECT * FROM timesheet 
            WHERE id IN (${placeholders})
            ORDER BY date, time_in
        `);
        
        return getByIds.all(...ids);
    } finally {
        db.close();
    }
}

/**
 * Gets all submitted timesheet entries for CSV export
 * 
 * @returns Array of submitted timesheet entries with formatted data
 */
export function getSubmittedTimesheetEntriesForExport() {
    const timer = dbLogger.startTimer('get-submitted-entries-export');
    const db = openDb();
    
    try {
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
            ORDER BY date ASC, time_in ASC
        `);
        
        const entries = getSubmitted.all();
        dbLogger.verbose('Submitted entries retrieved for export', { count: entries.length });
        timer.done({ count: entries.length });
        return entries;
    } finally {
        db.close();
    }
}

// ============================================================================
// CREDENTIALS MANAGEMENT
// ============================================================================

/**
 * Simple encryption/decryption for storing passwords
 * Note: This is a basic implementation. In production, use a proper encryption library
 */
function encryptPassword(password: string): string {
    // Simple base64 encoding - replace with proper encryption in production
    return Buffer.from(password).toString('base64');
}

function decryptPassword(encryptedPassword: string): string {
    // Simple base64 decoding - replace with proper decryption in production
    return Buffer.from(encryptedPassword, 'base64').toString('utf-8');
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
    const db = openDb();
    
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
    } finally {
        db.close();
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
    const db = openDb();
    
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
    } catch (error) {
        dbLogger.error('Could not retrieve credentials', error);
        timer.done({ outcome: 'error' });
        return null;
    } finally {
        db.close();
    }
}

/**
 * Lists all stored credentials (without passwords)
 * 
 * @returns Array of credential records without passwords
 */
export function listCredentials() {
    const db = openDb();
    
    try {
        const listCreds = db.prepare(`
            SELECT id, service, email, created_at, updated_at 
            FROM credentials 
            ORDER BY service
        `);
        
        return listCreds.all();
    } catch (error) {
        console.error('Error listing credentials:', error);
        return [];
    } finally {
        db.close();
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
    const db = openDb();
    
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
    } finally {
        db.close();
    }
}