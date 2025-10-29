/**
 * @fileoverview SQLite Data Service Plugin
 * 
 * Implementation of IDataService using SQLite database.
 * Wraps existing database functions with the plugin interface.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type {
  IDataService,
  TimesheetEntry,
  SaveResult,
  LoadResult,
  DeleteResult,
  ArchiveResult,
  DbTimesheetEntry
} from '../../../../shared/contracts/IDataService';
import type { PluginMetadata } from '../../../../shared/plugin-types';
import { getDb } from '../database';

/**
 * SQLite implementation of the data service
 */
export class SQLiteDataService implements IDataService {
  public readonly metadata: PluginMetadata = {
    name: 'sqlite',
    version: '1.1.2',
    author: 'Andrew Hughes',
    description: 'SQLite-based data persistence service'
  };

  /**
   * Convert time string (HH:mm) to minutes since midnight
   */
  private parseTimeToMinutes(timeStr: string): number {
    const parts = timeStr.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm`);
    }
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) {
      throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm`);
    }
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to time string (HH:mm)
   */
  private formatMinutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Save a draft timesheet entry
   */
  public async saveDraft(entry: TimesheetEntry): Promise<SaveResult> {
    try {
      // Validate required fields
      if (!entry.date) {
        return { success: false, error: 'Date is required' };
      }
      if (!entry.project) {
        return { success: false, error: 'Project is required' };
      }
      if (!entry.taskDescription) {
        return { success: false, error: 'Task description is required' };
      }
      
      // Convert time strings to minutes
      const timeInMinutes = this.parseTimeToMinutes(entry.timeIn);
      const timeOutMinutes = this.parseTimeToMinutes(entry.timeOut);
      
      // Validate times
      if (timeInMinutes % 15 !== 0 || timeOutMinutes % 15 !== 0) {
        return { success: false, error: 'Times must be in 15-minute increments' };
      }
      
      if (timeOutMinutes <= timeInMinutes) {
        return { success: false, error: 'Time Out must be after Time In' };
      }
      
      const db = getDb();
      let result;
      
      try {
        // If entry has an id, UPDATE; otherwise INSERT
        if (entry.id !== undefined && entry.id !== null) {
          const update = db.prepare(`
            UPDATE timesheet
            SET date = ?,
                time_in = ?,
                time_out = ?,
                project = ?,
                tool = ?,
                detail_charge_code = ?,
                task_description = ?,
                status = NULL
            WHERE id = ?
          `);
          
          result = update.run(
            entry.date,
            timeInMinutes,
            timeOutMinutes,
            entry.project,
            entry.tool || null,
            entry.chargeCode || null,
            entry.taskDescription,
            entry.id
          );
        } else {
          // Insert with deduplication
          const insert = db.prepare(`
            INSERT INTO timesheet
            (date, time_in, time_out, project, tool, detail_charge_code, task_description, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
            ON CONFLICT(date, time_in, project, task_description) DO UPDATE SET
              time_out = excluded.time_out,
              tool = excluded.tool,
              detail_charge_code = excluded.detail_charge_code,
              status = NULL
          `);
          
          result = insert.run(
            entry.date,
            timeInMinutes,
            timeOutMinutes,
            entry.project,
            entry.tool || null,
            entry.chargeCode || null,
            entry.taskDescription
          );
        }
        
        return { success: true, changes: result.changes };
      } finally {
        db.close();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Load all draft timesheet entries
   */
  public async loadDraft(): Promise<LoadResult> {
    try {
      const db = getDb();
      
      try {
        const getPending = db.prepare(`
          SELECT * FROM timesheet 
          WHERE status IS NULL
          ORDER BY date ASC, time_in ASC
        `);
        
        const entries = getPending.all() as Array<{
          id: number;
          date: string;
          time_in: number;
          time_out: number;
          project: string;
          tool?: string;
          detail_charge_code?: string;
          task_description: string;
        }>;
        
        // Convert database format to grid format
        const gridData: TimesheetEntry[] = entries.map((entry) => ({
          id: entry.id,
          date: entry.date,
          timeIn: this.formatMinutesToTime(entry.time_in),
          timeOut: this.formatMinutesToTime(entry.time_out),
          project: entry.project,
          tool: entry.tool || null,
          chargeCode: entry.detail_charge_code || null,
          taskDescription: entry.task_description
        }));
        
        // Return one blank row if no entries, otherwise return the entries
        const entriesToReturn = gridData.length > 0 ? gridData : [{}] as TimesheetEntry[];
        return { success: true, entries: entriesToReturn };
      } finally {
        db.close();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not load draft timesheet entries',
        entries: []
      };
    }
  }

  /**
   * Delete a draft timesheet entry
   */
  public async deleteDraft(id: number): Promise<DeleteResult> {
    try {
      if (!id || typeof id !== 'number') {
        return { success: false, error: 'Valid ID is required' };
      }

      const db = getDb();
      
      try {
        const deleteStmt = db.prepare(`
          DELETE FROM timesheet 
          WHERE id = ? AND status IS NULL
        `);
        
        const result = deleteStmt.run(id);
        
        if (result.changes === 0) {
          return { success: false, error: 'Draft entry not found' };
        }
        
        return { success: true };
      } finally {
        db.close();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not delete draft timesheet entry'
      };
    }
  }

  /**
   * Get archive data (completed entries and credentials)
   */
  public async getArchiveData(): Promise<ArchiveResult> {
    try {
      const db = getDb();
      
      try {
        // Get completed timesheet entries
        const getTimesheet = db.prepare(`
          SELECT * FROM timesheet 
          WHERE status = 'Complete'
          ORDER BY date ASC, time_in ASC
        `);
        const timesheetEntries = getTimesheet.all() as DbTimesheetEntry[];
        
        // Get credentials (without passwords)
        const getCredentials = db.prepare(`
          SELECT id, service, email, created_at, updated_at 
          FROM credentials 
          ORDER BY service
        `);
        const credentials = getCredentials.all() as Array<{
          id: number;
          service: string;
          email: string;
          created_at: string;
          updated_at: string;
        }>;
        
        return {
          success: true,
          data: {
            timesheet: timesheetEntries,
            credentials: credentials
          }
        };
      } finally {
        db.close();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not load archive data'
      };
    }
  }

  /**
   * Get all timesheet entries (for database viewer)
   */
  public async getAllTimesheetEntries(): Promise<{ success: boolean; entries?: DbTimesheetEntry[]; error?: string }> {
    try {
      const db = getDb();
      
      try {
        const getAll = db.prepare(`
          SELECT * FROM timesheet 
          WHERE status = 'Complete'
          ORDER BY date ASC, time_in ASC
        `);
        const entries = getAll.all() as DbTimesheetEntry[];
        
        return { success: true, entries };
      } finally {
        db.close();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not get timesheet entries',
        entries: []
      };
    }
  }
}

