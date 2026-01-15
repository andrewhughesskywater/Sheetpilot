/**
 * @fileoverview Data Service Contract
 * 
 * Defines the interface for data persistence operations.
 * Any data storage implementation (SQLite, PostgreSQL, memory, etc.) must implement this interface.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { IPlugin } from "@sheetpilot/shared/plugin-types";

/**
 * Timesheet entry data structure
 * 
 * Hours format: Decimal values in 15-minute increments (0.25 = 15 min, 0.5 = 30 min, etc.)
 * Range: 0.25 to 24.0 hours
 */
export interface TimesheetEntry {
  id?: number;
  date: string;
  hours: number;
  project: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription: string;
}

/**
 * Database timesheet entry (as stored in database)
 * 
 * Hours is stored as a direct REAL field (not computed)
 * Hours format: Decimal values in 15-minute increments (0.25 = 15 min, 0.5 = 30 min, etc.)
 * Range: 0.25 to 24.0 hours
 */
export interface DbTimesheetEntry {
  id: number;
  date: string;
  hours: number | null;
  project: string;
  tool?: string | null;
  detail_charge_code?: string | null;
  task_description: string;
  status?: string | null;
  submitted_at?: string | null;
}

/**
 * Credential data structure
 */
export interface Credential {
  id: number;
  service: string;
  email: string;
  created_at: string;
  updated_at: string;
}

/**
 * Archive data containing historical records
 */
export interface ArchiveData {
  timesheet: DbTimesheetEntry[];
  credentials: Credential[];
}

/**
 * Result of save operation
 */
export interface SaveResult {
  success: boolean;
  changes?: number;
  error?: string;
  id?: number;
}

/**
 * Result of load operation
 */
export interface LoadResult {
  success: boolean;
  entries?: TimesheetEntry[];
  error?: string;
}

/**
 * Result of delete operation
 */
export interface DeleteResult {
  success: boolean;
  changes?: number;
  error?: string;
}

/**
 * Result of archive data load
 */
export interface ArchiveResult {
  success: boolean;
  data?: ArchiveData;
  error?: string;
}

/**
 * Data service interface for persistence operations
 * Implementations handle storage and retrieval of timesheet data
 */
export interface IDataService extends IPlugin {
  /**
   * Save a draft timesheet entry
   * @param entry Timesheet entry to save
   * @returns Result of save operation
   */
  saveDraft(entry: TimesheetEntry): Promise<SaveResult>;

  /**
   * Load all draft timesheet entries
   * @returns Array of draft entries
   */
  loadDraft(): Promise<LoadResult>;

  /**
   * Delete a draft timesheet entry
   * @param id Entry ID to delete
   * @returns Result of delete operation
   */
  deleteDraft(id: number): Promise<DeleteResult>;

  /**
   * Get archive data (completed entries)
   * @returns Archive data containing completed entries and credentials
   */
  getArchiveData(): Promise<ArchiveResult>;

  /**
   * Get all timesheet entries (for database viewer)
   * @returns All entries with full details
   */
  getAllTimesheetEntries(): Promise<{ success: boolean; entries?: DbTimesheetEntry[]; error?: string }>;
}

