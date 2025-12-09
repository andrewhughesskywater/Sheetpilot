/**
 * @fileoverview Repositories Index
 * 
 * Re-exports all repository functions for convenient importing.
 * Provides a facade over the repository layer.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

// Connection Management
export {
    setDbPath,
    getDbPath,
    getDb,
    openDb,
    closeConnection,
    closeConnectionForTesting,
    resetPreventReconnectionFlag,
    shutdownDatabase,
    ensureSchema,
    rebuildDatabase
} from './connection-manager';

// Timesheet Repository
export {
    insertTimesheetEntry,
    getPendingTimesheetEntries,
    markTimesheetEntriesAsInProgress,
    resetTimesheetEntriesStatus,
    resetInProgressTimesheetEntries,
    markTimesheetEntriesAsSubmitted,
    removeFailedTimesheetEntries,
    getTimesheetEntriesByIds,
    getSubmittedTimesheetEntriesForExport
} from './timesheet-repository';

// Credentials Repository
export {
    storeCredentials,
    getCredentials,
    listCredentials,
    deleteCredentials,
    clearAllCredentials
} from './credentials-repository';

// Session Repository
export {
    createSession,
    validateSession,
    clearSession,
    clearUserSessions,
    getSessionByEmail
} from './session-repository';

// Migrations
export {
    CURRENT_SCHEMA_VERSION,
    getCurrentSchemaVersion,
    setSchemaVersion,
    createBackup,
    runMigrations,
    needsMigration
} from './migrations';

