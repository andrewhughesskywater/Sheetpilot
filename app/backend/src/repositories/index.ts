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
  closeConnection,
  closeConnectionForTesting,
  ensureSchema,
  getDb,
  getDbPath,
  openDb,
  rebuildDatabase,
  resetPreventReconnectionFlag,
  setDbPath,
  shutdownDatabase,
} from './connection-manager';

// Timesheet Repository
export {
  checkDuplicateEntry,
  getDuplicateEntries,
  getPendingTimesheetEntries,
  getSubmittedTimesheetEntriesForExport,
  getTimesheetEntriesByIds,
  insertTimesheetEntries,
  insertTimesheetEntry,
  markTimesheetEntriesAsInProgress,
  markTimesheetEntriesAsSubmitted,
  removeFailedTimesheetEntries,
  resetInProgressTimesheetEntries,
  resetTimesheetEntriesStatus,
  type TimesheetDbRow,
} from './timesheet-repository';

// Credentials Repository
export {
  clearAllCredentials,
  deleteCredentials,
  getCredentials,
  listCredentials,
  storeCredentials,
} from './credentials-repository';

// Session Repository
export {
  clearSession,
  clearUserSessions,
  createSession,
  getSessionByEmail,
  validateSession,
} from './session-repository';

// Migrations
export {
  createBackup,
  CURRENT_SCHEMA_VERSION,
  getCurrentSchemaVersion,
  needsMigration,
  runMigrations,
  setSchemaVersion,
} from './migrations';
