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
    insertTimesheetEntries,
    checkDuplicateEntry,
    getDuplicateEntries,
    getPendingTimesheetEntries,
    markTimesheetEntriesAsInProgress,
    resetTimesheetEntriesStatus,
    resetInProgressTimesheetEntries,
    markTimesheetEntriesAsSubmitted,
    removeFailedTimesheetEntries,
    getTimesheetEntriesByIds,
    getSubmittedTimesheetEntriesForExport,
    type TimesheetDbRow
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

// Business Config Service
export {
    getAllProjects,
    getProjectsWithoutTools,
    getToolsForProject,
    getAllTools,
    getToolsWithoutChargeCodes,
    getAllChargeCodes,
    isProjectWithoutTools,
    doesProjectNeedTools,
    isToolWithoutChargeCode,
    doesToolNeedChargeCode,
    isValidProject,
    isValidToolForProject,
    isValidChargeCode,
    normalizeTimesheetRow,
    invalidateCache
} from './business-config.service';

// Business Config Repository
export {
    getAllProjects as repoGetAllProjects,
    getProjectsWithoutTools as repoGetProjectsWithoutTools,
    getAllTools as repoGetAllTools,
    getToolsWithoutChargeCodes as repoGetToolsWithoutChargeCodes,
    getToolsByProject as repoGetToolsByProject,
    getAllChargeCodes as repoGetAllChargeCodes,
    getProjectById,
    getProjectByName,
    getToolById,
    getToolByName,
    getChargeCodeById,
    getChargeCodeByName,
    updateProject,
    updateTool,
    updateChargeCode,
    addProject,
    addTool,
    addChargeCode,
    linkToolToProject,
    unlinkToolFromProject
} from './business-config.repository';

