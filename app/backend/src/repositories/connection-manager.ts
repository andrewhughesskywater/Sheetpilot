/**
 * @fileoverview Database Connection Manager
 * 
 * Manages the singleton database connection with thread-safe initialization.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type BetterSqlite3 from 'better-sqlite3';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { dbLogger } from '@sheetpilot/shared/logger';
import {
    DatabaseConnectionError,
    DatabaseSchemaError
} from '@sheetpilot/shared/errors';

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
let isInitializing = false;
let schemaInitialized = false;
let preventReconnection = false; // Test-only flag to prevent auto-reconnection

/**
 * Sets the database file path
 * Closes existing connection if path changes and resets schema initialization state
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
 */
export const getDbPath = () => DB_PATH;

/**
 * Check if the connection is open and healthy
 * If connection is closed, reset the singleton to allow reinitialization
 */
function isConnectionHealthy(): boolean {
    try {
        if (connectionInstance === null) {
            return false;
        }
        // Check if connection is actually open
        const isOpen = connectionInstance.open;
        if (!isOpen) {
            // Connection is closed, reset singleton
            connectionInstance = null;
            schemaInitialized = false;
            return false;
        }
        return true;
    } catch {
        // Connection is in an invalid state, reset singleton
        connectionInstance = null;
        schemaInitialized = false;
        return false;
    }
}

/**
 * Closes the persistent database connection
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
            isInitializing = false;
            schemaInitialized = false;
            preventReconnection = false; // Reset flag when explicitly closing
        }
    } else {
        // Reset flag even if connection was already closed
        preventReconnection = false;
    }
}

/**
 * Resets the preventReconnection flag (for testing)
 */
export function resetPreventReconnectionFlag(): void {
    preventReconnection = false;
}

/**
 * Test-only function to close connection and prevent auto-reconnection
 * This allows tests to verify error handling when database is closed
 */
export function closeConnectionForTesting(): void {
    if (connectionInstance) {
        try {
            connectionInstance.close();
            dbLogger.info('Database connection closed for testing');
        } catch (error) {
            dbLogger.error('Error closing database connection for testing', error);
        } finally {
            connectionInstance = null;
            isInitializing = false;
            schemaInitialized = false;
            preventReconnection = true; // Prevent auto-reconnection
        }
    }
}

/**
 * Gracefully shutdown database connection
 */
export function shutdownDatabase(): void {
    closeConnection();
}

/**
 * Module cache for better-sqlite3
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
 * Internal schema creation (takes an open database connection)
 * @private
 */
export function ensureSchemaInternal(db: BetterSqlite3.Database) {
    
    // Create timesheet table with comprehensive schema and constraints
    // Note: Core fields are nullable to allow saving partial/draft rows.
    // Required field validation is enforced at the application level before submission.
    db.exec(`
        CREATE TABLE IF NOT EXISTS timesheet(
            -- Primary key with auto-increment
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            
            -- Computed column: hours worked (automatically calculated from time difference)
            -- Returns NULL if either time_in or time_out is NULL
            hours REAL
                GENERATED ALWAYS AS (
                    CASE WHEN time_in IS NOT NULL AND time_out IS NOT NULL 
                         THEN (time_out - time_in) / 60.0 
                         ELSE NULL 
                    END
                ) 
                STORED,
            
            -- Core timesheet data fields (nullable to allow partial/draft saves)
            date TEXT,                             -- Work date in YYYY-MM-DD format
            time_in INTEGER,                       -- Start time in minutes since midnight
            time_out INTEGER,                      -- End time in minutes since midnight
            project TEXT,                          -- Project name
            tool TEXT,                             -- Tool used (optional)
            detail_charge_code TEXT,               -- Charge code (optional)
            task_description TEXT,                 -- Task description
            
            -- Submission tracking fields
            status TEXT DEFAULT NULL,              -- Submission status: NULL (pending), 'in_progress' (submitting), 'Complete' (submitted)
            submitted_at DATETIME DEFAULT NULL,    -- Timestamp when successfully submitted
            
            -- Data validation constraints (only apply when values are present)
            CHECK(time_in IS NULL OR time_in BETWEEN 0 AND 1439),     -- Valid time range: 00:00 to 23:59
            CHECK(time_out IS NULL OR time_out BETWEEN 1 AND 1440),   -- Valid time range: 00:01 to 24:00
            CHECK(time_in IS NULL OR time_out IS NULL OR time_out > time_in),  -- End time must be after start time
            CHECK(time_in IS NULL OR time_in % 15 = 0),               -- Start time must be 15-minute increment
            CHECK(time_out IS NULL OR time_out % 15 = 0)              -- End time must be 15-minute increment
        );
        
        -- Performance indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_timesheet_date ON timesheet(date);
        CREATE INDEX IF NOT EXISTS idx_timesheet_project ON timesheet(project);
        CREATE INDEX IF NOT EXISTS idx_timesheet_status ON timesheet(status);
        
        -- Unique constraint only applies to complete rows (all key fields non-null)
        CREATE UNIQUE INDEX IF NOT EXISTS uq_timesheet_nk
            ON timesheet(date, time_in, project, task_description)
            WHERE date IS NOT NULL 
              AND time_in IS NOT NULL 
              AND project IS NOT NULL 
              AND task_description IS NOT NULL;
        
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
        
        -- Schema version tracking table for migrations
        -- CHECK constraint ensures only one row can exist (singleton pattern)
        CREATE TABLE IF NOT EXISTS schema_info(
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version INTEGER NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

/**
 * Reset closed connection instance
 */
function resetClosedConnection(): void {
    if (connectionInstance !== null && !connectionInstance.open) {
        connectionInstance = null;
        schemaInitialized = false;
    }
}

/**
 * Acquire initialization lock and return unlock function
 */
function acquireInitializationLock(): (() => void) {
    isInitializing = true;
    let unlockFunction: (() => void) = () => {};
    const currentLock = connectionLock.then(() => {
        return new Promise<void>((resolve) => {
            unlockFunction = resolve;
        });
    });
    connectionLock = currentLock;
    return unlockFunction;
}

/**
 * Create and configure database instance
 */
function createDatabaseInstance(): BetterSqlite3.Database {
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
    
    return db;
}

/**
 * Initialize database schema if not already initialized
 */
function initializeSchemaIfNeeded(db: BetterSqlite3.Database, unlockFunction: () => void): void {
    if (schemaInitialized) return;
    
    const timer = dbLogger.startTimer('schema-init');
    try {
        ensureSchemaInternal(db);
        schemaInitialized = true;
        dbLogger.info('Database schema initialized', { dbPath: DB_PATH });
    } catch (error) {
        isInitializing = false;
        unlockFunction();
        throw new DatabaseSchemaError({
            dbPath: DB_PATH,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
    } finally {
        timer.done();
    }
}

/**
 * Initialize new database connection
 */
function initializeConnection(unlockFunction: () => void): void {
    try {
        // Double-check after acquiring lock - another thread might have initialized
        if (isConnectionHealthy()) {
            isInitializing = false;
            unlockFunction();
            return;
        }
        
        const db = createDatabaseInstance();
        initializeSchemaIfNeeded(db, unlockFunction);
        
        connectionInstance = db;
        isInitializing = false;
        dbLogger.info('Persistent database connection established', { dbPath: DB_PATH });
    } catch (error) {
        isInitializing = false;
        dbLogger.error('Could not establish database connection', error);
        unlockFunction();
        throw new DatabaseConnectionError({
            dbPath: DB_PATH,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
    } finally {
        // Ensure unlock is called and flag is reset even if something unexpected happens
        if (isInitializing) {
            isInitializing = false;
        }
        unlockFunction();
    }
}

/**
 * Gets or creates the singleton database connection
 */
function getDbConnection(): BetterSqlite3.Database {
    // If we already have a healthy connection, return it
    if (isConnectionHealthy()) {
        return connectionInstance!;
    }
    
    // If reconnection is prevented (for testing), throw error
    if (preventReconnection) {
        throw new DatabaseConnectionError({
            dbPath: DB_PATH,
            error: 'Database connection is closed (test mode)'
        });
    }
    
    // Reset connection instance if it was closed
    resetClosedConnection();
    
    // If another thread is initializing, wait for it and check again
    if (connectionInstance === null && !isInitializing) {
        const unlockFunction = acquireInitializationLock();
        initializeConnection(unlockFunction);
    }
    
    // If we still don't have a connection after waiting, something went wrong
    if (!connectionInstance) {
        throw new DatabaseConnectionError({
            dbPath: DB_PATH,
            error: 'Could not establish database connection after initialization'
        });
    }
    
    return connectionInstance;
}

/**
 * Gets database connection with retry logic
 */
export function getDb(): BetterSqlite3.Database {
    return getDbConnection();
}

/**
 * Backwards-compatible alias for getDb()
 */
export function openDb(): BetterSqlite3.Database {
    return getDb();
}

/**
 * Ensures the database schema is created and up-to-date
 */
export function ensureSchema() {
    // NOTE: Do NOT reset preventReconnection flag here
    // Tests that close connection should remain closed until explicitly reset
    // Schema initialization should only happen if connection is allowed
    
    if (schemaInitialized) {
        dbLogger.debug('Schema already ensured, skipping');
        return;
    }
    
    const timer = dbLogger.startTimer('ensure-schema');
    dbLogger.info('Ensuring database schema is up to date');
    const db = getDb();
    
    ensureSchemaInternal(db);
    schemaInitialized = true;
    
    dbLogger.info('Database schema ensured successfully');
    timer.done();
}

/**
 * Rebuilds the database by dropping and recreating all tables
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
            DROP TABLE IF EXISTS schema_info;
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

