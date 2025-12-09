/**
 * @fileoverview Memory Data Service Plugin
 * 
 * In-memory implementation of IDataService for testing and development.
 * Data is stored in memory and lost when the application closes.
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

/**
 * In-memory implementation of the data service
 */
export class MemoryDataService implements IDataService {
  public readonly metadata: PluginMetadata = {
    name: 'memory',
    version: '1.1.2',
    author: 'Andrew Hughes',
    description: 'In-memory data persistence service for testing'
  };

  private draftEntries: TimesheetEntry[] = [];
  private archiveEntries: DbTimesheetEntry[] = [];
  private nextId: number = 1;

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
      
      // If entry has an id, update existing entry
      if (entry.id !== undefined && entry.id !== null) {
        const index = this.draftEntries.findIndex(e => e.id === entry.id);
        if (index >= 0) {
          this.draftEntries[index] = { ...entry };
          return { success: true, changes: 1 };
        } else {
          return { success: false, error: 'Entry not found' };
        }
      } else {
        // Insert new entry
        const newEntry = { ...entry, id: this.nextId++ };
        this.draftEntries.push(newEntry);
        return { success: true, changes: 1, id: newEntry.id };
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
      // Return one blank row if no entries, otherwise return the entries
      const entriesToReturn = this.draftEntries.length > 0 
        ? [...this.draftEntries] 
        : [{}] as TimesheetEntry[];
      
      return { success: true, entries: entriesToReturn };
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

      const index = this.draftEntries.findIndex(e => e.id === id);
      if (index < 0) {
        return { success: false, error: 'Entry not found' };
      }
      
      this.draftEntries.splice(index, 1);
      return { success: true, changes: 1 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not delete draft timesheet entry'
      };
    }
  }

  /**
   * Archive a draft entry (move to archive)
   */
  public async archiveEntry(id: number): Promise<{ success: boolean; error?: string }> {
    try {
      if (!id || typeof id !== 'number') {
        return { success: false, error: 'Valid ID is required' };
      }

      const index = this.draftEntries.findIndex(e => e.id === id);
      if (index < 0) {
        return { success: false, error: 'Entry not found' };
      }
      
      const entry = this.draftEntries[index];
      
      // Validate required fields exist before archiving
      if (!entry || !entry.id || !entry.date || !entry.timeIn || !entry.timeOut || 
          !entry.project || !entry.taskDescription) {
        return { success: false, error: 'Entry missing required fields' };
      }
      
      // Convert to DbTimesheetEntry format
      const dbEntry: DbTimesheetEntry = {
        id: entry.id,
        date: entry.date,
        time_in: this.parseTimeToMinutes(entry.timeIn),
        time_out: this.parseTimeToMinutes(entry.timeOut),
        hours: this.calculateHours(entry.timeIn, entry.timeOut),
        project: entry.project,
        tool: entry.tool || null,
        detail_charge_code: entry.chargeCode || null,
        task_description: entry.taskDescription,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      };
      
      this.archiveEntries.push(dbEntry);
      this.draftEntries.splice(index, 1);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not archive entry'
      };
    }
  }

  /**
   * Load archived entries
   */
  public async loadArchive(): Promise<{ success: boolean; entries?: DbTimesheetEntry[]; error?: string }> {
    try {
      return { success: true, entries: [...this.archiveEntries] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not load archive',
        entries: []
      };
    }
  }

  /**
   * Parse time string to minutes
   */
  private parseTimeToMinutes(time: string): number {
    const parts = time.split(':').map(Number);
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    return hours * 60 + minutes;
  }

  /**
   * Calculate hours between two times
   */
  private calculateHours(timeIn: string, timeOut: string): number {
    const inMinutes = this.parseTimeToMinutes(timeIn);
    const outMinutes = this.parseTimeToMinutes(timeOut);
    return (outMinutes - inMinutes) / 60;
  }

  /**
   * Get archive data (completed entries and credentials)
   */
  public async getArchiveData(): Promise<ArchiveResult> {
    try {
      return {
        success: true,
        data: {
          timesheet: [...this.archiveEntries],
          credentials: []
        }
      };
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
      return { success: true, entries: [...this.archiveEntries] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not get timesheet entries',
        entries: []
      };
    }
  }

  /**
   * Add a completed entry to archive (for testing)
   */
  public addToArchive(entry: DbTimesheetEntry): void {
    this.archiveEntries.push(entry);
  }

  /**
   * Clear all data (for testing)
   */
  public clearAll(): void {
    this.draftEntries = [];
    this.archiveEntries = [];
    this.nextId = 1;
  }
}

