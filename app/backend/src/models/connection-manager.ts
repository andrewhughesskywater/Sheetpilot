/**
 * @fileoverview Database Connection Manager
 *
 * Manages the singleton database connection with thread-safe initialization.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type BetterSqlite3 from "better-sqlite3";
import * as path from "path";
import { dbLogger } from "@sheetpilot/shared/logger";
import { DatabaseConnectionError } from "@sheetpilot/shared/errors";
import { ensureSchemaInternal } from "./connection-manager.schema";
import { fixGeneratedHoursColumnIfNeeded } from "./connection-manager.migration-helpers";
import { performConnectionInitialization } from "./connection-manager.connection-helpers";

/**
 * Database file path configuration
 * Can be overridden via SHEETPILOT_DB environment variable
 * Defaults to 'sheetpilot.sqlite' in the current working directory
 */
let DB_PATH = process.env["SHEETPILOT_DB"]
  ? path.resolve(process.env["SHEETPILOT_DB"])
  : path.resolve(process.cwd(), "sheetpilot.sqlite");

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
    dbLogger.info("Database path changed", { newPath });
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
      dbLogger.info("Database connection closed");
    } catch (error) {
      dbLogger.error("Error closing database connection", error);
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
      dbLogger.info("Database connection closed for testing");
    } catch (error) {
      dbLogger.error("Error closing database connection for testing", error);
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
 * Re-export ensureSchemaInternal for backwards compatibility
 */
export { ensureSchemaInternal } from "./connection-manager.schema";

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
      error: "Database connection is closed (test mode)",
    });
  }

  // Note: Since getDbConnection is synchronous, we can't await promises here
  // If initialization is in progress, we'll proceed with the lock check below

  // Reset connection instance if it was closed
  // (isConnectionHealthy may have reset it, but ensure we handle it here too)
  if (connectionInstance !== null && !connectionInstance.open) {
    connectionInstance = null;
    schemaInitialized = false;
  }

  // If another thread is initializing, wait for it and check again
  if (connectionInstance === null && !isInitializing) {
    // Lock initialization to prevent race conditions
    isInitializing = true;
    let unlockFunction: () => void = () => {};
    const currentLock = connectionLock.then(() => {
      return new Promise<void>((resolve) => {
        unlockFunction = resolve;
      });
    });
    connectionLock = currentLock;

    connectionInstance = performConnectionInitialization(
      DB_PATH,
      isConnectionHealthy,
      () => connectionInstance,
      (db) => {
        connectionInstance = db;
      },
      () => schemaInitialized,
      (value) => {
        schemaInitialized = value;
      },
      (value) => {
        isInitializing = value;
      },
      unlockFunction
    );
  }

  // If we still don't have a connection after waiting, something went wrong
  if (!connectionInstance) {
    throw new DatabaseConnectionError({
      dbPath: DB_PATH,
      error: "Could not establish database connection after initialization",
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
    dbLogger.debug("Schema already ensured, skipping");
    return;
  }

  const timer = dbLogger.startTimer("ensure-schema");
  dbLogger.info("Ensuring database schema is up to date");
  const db = getDb();

  ensureSchemaInternal(db);

  // Safety check: Always verify hours column is not generated (fix if needed)
  // This runs even if migrations already ran, as a safety net
  fixGeneratedHoursColumnIfNeeded(db);

  schemaInitialized = true;

  dbLogger.info("Database schema ensured successfully");
  timer.done();
}

/**
 * Rebuilds the database by dropping and recreating all tables
 */
export function rebuildDatabase(): void {
  const timer = dbLogger.startTimer("rebuild-database");
  const db = getDb();

  try {
    dbLogger.warn("Rebuilding database - dropping all tables");

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

    dbLogger.info("Database rebuilt successfully");
    timer.done();
  } catch (error) {
    dbLogger.error("Could not rebuild database", error);
    timer.done({ outcome: "error" });
    throw error;
  }
}
