/**
 * @fileoverview Schema creation helpers for database connection manager
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type BetterSqlite3 from "better-sqlite3";
import { dbLogger } from "@sheetpilot/shared/logger";
import { getDbPath } from "./connection-manager";

/**
 * Internal schema creation (takes an open database connection)
 * @private
 */
export function ensureSchemaInternal(db: BetterSqlite3.Database) {
  const DB_PATH = getDbPath();
  try {
    // Create timesheet table with comprehensive schema and constraints
    // Note: Core fields are nullable to allow saving partial/draft rows.
    // Required field validation is enforced at the application level before submission.
    db.exec(`
        CREATE TABLE IF NOT EXISTS timesheet(
            -- Primary key with auto-increment
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            
            -- Hours worked as direct field (not computed)
            -- Decimal values in 15-minute increments (0.25 = 15 min, 0.5 = 30 min, etc.)
            -- Range: 0.25 to 24.0 hours
            hours REAL CHECK(hours IS NULL OR (hours >= 0.25 AND hours <= 24.0 AND (hours * 4) % 1 = 0)),
            
            -- Core timesheet data fields (nullable to allow partial/draft saves)
            date TEXT,                             -- Work date in YYYY-MM-DD format
            project TEXT,                          -- Project name
            tool TEXT,                             -- Tool used (optional)
            detail_charge_code TEXT,               -- Charge code (optional)
            task_description TEXT,                 -- Task description
            
            -- Submission tracking fields
            status TEXT DEFAULT NULL,              -- Submission status: NULL (pending), 'in_progress' (submitting), 'Complete' (submitted)
            submitted_at DATETIME DEFAULT NULL     -- Timestamp when successfully submitted
        );
        
        -- Performance indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_timesheet_date ON timesheet(date);
        CREATE INDEX IF NOT EXISTS idx_timesheet_project ON timesheet(project);
        CREATE INDEX IF NOT EXISTS idx_timesheet_status ON timesheet(status);
    `);

    // Create unique index separately to handle existing data that might violate the constraint
    // Check if index already exists first
    const indexExists = db
      .prepare(
        `
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name='uq_timesheet_nk'
    `
      )
      .get() as { name: string } | undefined;

    if (!indexExists) {
      // Check if there's existing data that would violate the unique constraint
      const duplicateCount = db
        .prepare(
          `
          SELECT COUNT(*) as count
          FROM (
              SELECT date, project, task_description, COUNT(*) as cnt
              FROM timesheet
              WHERE date IS NOT NULL 
                AND project IS NOT NULL 
                AND task_description IS NOT NULL
              GROUP BY date, project, task_description
              HAVING cnt > 1
          )
      `
        )
        .get() as { count: number } | undefined;

      if (duplicateCount && duplicateCount.count > 0) {
        dbLogger.warn(
          "Skipping unique index creation due to existing duplicate data",
          {
            duplicateCount: duplicateCount.count,
            dbPath: DB_PATH,
          }
        );
        // Don't create the unique index if there are duplicates
        // The application layer should handle uniqueness validation
      } else {
        // Safe to create the unique index
        try {
          db.exec(`
              CREATE UNIQUE INDEX uq_timesheet_nk
                  ON timesheet(date, project, task_description)
                  WHERE date IS NOT NULL 
                    AND project IS NOT NULL 
                    AND task_description IS NOT NULL
          `);
          dbLogger.verbose("Unique index created successfully", {
            dbPath: DB_PATH,
          });
        } catch (indexError) {
          // If index creation still fails, log warning but don't fail schema initialization
          dbLogger.warn("Could not create unique index (non-fatal)", {
            error:
              indexError instanceof Error
                ? indexError.message
                : String(indexError),
            dbPath: DB_PATH,
          });
        }
      }
    }

    // Create other tables
    db.exec(`
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
  } catch (error) {
    dbLogger.error("Error executing schema creation SQL", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      dbPath: DB_PATH,
    });
    throw error;
  }
}
