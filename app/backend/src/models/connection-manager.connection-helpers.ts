/**
 * @fileoverview Connection initialization helpers for database connection manager
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type BetterSqlite3 from "better-sqlite3";
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import { dbLogger } from "@sheetpilot/shared/logger";
import {
  DatabaseConnectionError,
  DatabaseSchemaError,
} from "@sheetpilot/shared/errors";
import { ensureSchemaInternal } from "./connection-manager.schema";

/**
 * Type for checking connection health
 */
type ConnectionHealthChecker = () => boolean;

/**
 * Type for getting connection instance
 */
type ConnectionGetter = () => BetterSqlite3.Database | null;

/**
 * Type for setting connection instance
 */
type ConnectionSetter = (db: BetterSqlite3.Database | null) => void;

/**
 * Type for getting schema initialized state
 */
type SchemaInitializedGetter = () => boolean;

/**
 * Type for setting schema initialized state
 */
type SchemaInitializedSetter = (value: boolean) => void;

/**
 * Type for setting isInitializing flag
 */
type IsInitializingSetter = (value: boolean) => void;

/**
 * Type for unlock function
 */
type UnlockFunction = () => void;

/**
 * Ensures the database directory exists
 */
export function ensureDatabaseDirectory(dbPath: string): void {
  const dbDir = path.dirname(dbPath);
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    dbLogger.verbose("Database directory ensured", {
      dbDir,
      dbPath: dbPath,
    });
  } catch (mkdirError) {
    const errorMsg = `Could not create database directory: ${dbDir}`;
    dbLogger.error(errorMsg, {
      error:
        mkdirError instanceof Error
          ? mkdirError.message
          : String(mkdirError),
      dbDir,
      dbPath: dbPath,
    });
    throw new DatabaseConnectionError({
      dbPath: dbPath,
      error: errorMsg,
      stack: mkdirError instanceof Error ? mkdirError.stack : undefined,
    });
  }
}

/**
 * Opens a new database connection
 */
export function openDatabaseConnection(dbPath: string): BetterSqlite3.Database {
  dbLogger.verbose("Opening persistent database connection", {
    dbPath: dbPath,
  });

  // Use the statically imported Database - in tests this will be the mocked version
  // Vitest mocks are hoisted, so the static import will use the mock
  let db: BetterSqlite3.Database;
  try {
    db = new Database(dbPath);
  } catch (openError) {
    const errorMsg = `Could not open database file: ${dbPath}`;
    dbLogger.error(errorMsg, {
      error:
        openError instanceof Error ? openError.message : String(openError),
      stack: openError instanceof Error ? openError.stack : undefined,
      dbPath: dbPath,
      dbDir: path.dirname(dbPath),
    });
    throw new DatabaseConnectionError({
      dbPath: dbPath,
      error: errorMsg,
      stack: openError instanceof Error ? openError.stack : undefined,
    });
  }

  // Configure WAL mode for better concurrency
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -32768"); // 32MB cache

  return db;
}

/**
 * Initializes the database schema if not already initialized
 */
export function initializeSchemaIfNeeded(
  db: BetterSqlite3.Database,
  dbPath: string,
  schemaInitialized: boolean
): boolean {
  // Schema initialization (thread-safe - only first call succeeds)
  if (!schemaInitialized) {
    const timer = dbLogger.startTimer("schema-init");
    try {
      ensureSchemaInternal(db);
      dbLogger.info("Database schema initialized", { dbPath: dbPath });
      timer.done();
      return true;
    } catch (error) {
      // Close the database connection if schema initialization fails
      try {
        db.close();
      } catch (closeError) {
        dbLogger.warn("Could not close database after schema error", {
          error:
            closeError instanceof Error
              ? closeError.message
              : String(closeError),
        });
      }
      timer.done({ outcome: "error" });
      const schemaError = new DatabaseSchemaError({
        dbPath: dbPath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      dbLogger.error("Could not initialize database schema", schemaError);
      throw schemaError;
    }
  }
  return schemaInitialized;
}

/**
 * Performs the database connection initialization logic
 * This function contains the complex initialization block extracted from getDbConnection
 */
export function performConnectionInitialization(
  dbPath: string,
  isConnectionHealthy: ConnectionHealthChecker,
  getConnectionInstance: ConnectionGetter,
  setConnectionInstance: ConnectionSetter,
  getSchemaInitialized: SchemaInitializedGetter,
  setSchemaInitialized: SchemaInitializedSetter,
  setIsInitializing: IsInitializingSetter,
  unlockFunction: UnlockFunction
): BetterSqlite3.Database {
  try {
    // Double-check after acquiring lock - another thread might have initialized
    if (isConnectionHealthy()) {
      setIsInitializing(false);
      unlockFunction();
      return getConnectionInstance()!;
    }

    // Ensure the database directory exists
    try {
      ensureDatabaseDirectory(dbPath);
    } catch (error) {
      setIsInitializing(false);
      unlockFunction();
      throw error;
    }

    // Open database connection
    let db: BetterSqlite3.Database;
    try {
      db = openDatabaseConnection(dbPath);
    } catch (error) {
      setIsInitializing(false);
      unlockFunction();
      throw error;
    }

    // Schema initialization (thread-safe - only first call succeeds)
    if (!getSchemaInitialized()) {
      const timer = dbLogger.startTimer("schema-init");
      try {
        ensureSchemaInternal(db);
        setSchemaInitialized(true);
        dbLogger.info("Database schema initialized", { dbPath: dbPath });
      } catch (error) {
        // Close the database connection if schema initialization fails
        try {
          db.close();
        } catch (closeError) {
          dbLogger.warn("Could not close database after schema error", {
            error:
              closeError instanceof Error
                ? closeError.message
                : String(closeError),
          });
        }
        setIsInitializing(false);
        unlockFunction();
        const schemaError = new DatabaseSchemaError({
          dbPath: dbPath,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        dbLogger.error("Could not initialize database schema", schemaError);
        throw schemaError;
      } finally {
        timer.done();
      }
    }

    setConnectionInstance(db);
    setIsInitializing(false);
    dbLogger.info("Persistent database connection established", {
      dbPath: dbPath,
    });
    
    return db;
  } catch (error) {
    setIsInitializing(false);
    // Don't log connection errors if it's already a DatabaseSchemaError (we already logged it)
    if (!(error instanceof DatabaseSchemaError)) {
      dbLogger.error("Could not establish database connection", error);
    }
    unlockFunction();
    // If it's already a DatabaseSchemaError, re-throw it instead of wrapping it
    if (error instanceof DatabaseSchemaError) {
      throw error;
    }
    throw new DatabaseConnectionError({
      dbPath: dbPath,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    // Ensure unlock is called and flag is reset even if something unexpected happens
    setIsInitializing(false);
    unlockFunction();
  }
}
