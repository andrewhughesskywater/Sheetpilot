/**
 * @fileoverview Mock Database for Testing
 * 
 * In-memory database implementation for testing without file system dependencies.
 * Provides SQLite-compatible interface with test-specific features.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { DbTimesheetEntry } from '../../../shared/contracts/IDataService';

/**
 * In-memory database for testing
 */
export class MockDatabase {
  private timesheetEntries: DbTimesheetEntry[] = [];
  private credentials: Array<{
    id: number;
    service: string;
    email: string;
    password: string;
    created_at: string;
    updated_at: string;
  }> = [];
  private nextId = 1;

  /**
   * Initialize database with schema
   */
  exec(sql: string): void {
    // Mock schema creation - just initialize empty arrays
    if (sql.includes('CREATE TABLE')) {
      this.timesheetEntries = [];
      this.credentials = [];
      this.nextId = 1;
    }
  }

  /**
   * Prepare a statement for execution
   */
  prepare(sql: string) {
    return {
      all: () => {
        if (sql.includes('SELECT * FROM timesheet')) {
          return this.timesheetEntries;
        }
        if (sql.includes('SELECT * FROM credentials')) {
          return this.credentials.map(c => ({
            id: c.id,
            service: c.service,
            email: c.email,
            created_at: c.created_at,
            updated_at: c.updated_at
          }));
        }
        return [];
      },
      run: (params: unknown[]) => {
        if (sql.includes('INSERT INTO timesheet')) {
          const entry: DbTimesheetEntry = {
            id: this.nextId++,
            date: params[0] as string,
            time_in: params[1] as number,
            time_out: params[2] as number,
            hours: ((params[2] as number) - (params[1] as number)) / 60.0,
            project: params[3] as string,
            task_description: params[6] as string,
            ...((params[4] as string) ? { tool: params[4] as string } : {}),
            ...((params[5] as string) ? { detail_charge_code: params[5] as string } : {}),
            ...((params[7] as string) ? { status: params[7] as string } : {}),
            ...((params[8] as string) ? { submitted_at: params[8] as string } : {})
          };
          this.timesheetEntries.push(entry);
          return { changes: 1, lastInsertRowid: entry.id };
        }
        if (sql.includes('UPDATE timesheet')) {
          const id = params[0] as number;
          const entryIndex = this.timesheetEntries.findIndex(e => e.id === id);
          if (entryIndex >= 0) {
            if (params[1] && typeof params[1] === 'object') {
              const updates = params[1] as Partial<DbTimesheetEntry>;
              this.timesheetEntries[entryIndex] = {
                ...this.timesheetEntries[entryIndex],
                ...updates
              } as DbTimesheetEntry;
            }
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (sql.includes('DELETE FROM timesheet')) {
          const id = params[0] as number;
          const initialLength = this.timesheetEntries.length;
          this.timesheetEntries = this.timesheetEntries.filter(e => e.id !== id);
          return { changes: initialLength - this.timesheetEntries.length };
        }
        if (sql.includes('INSERT INTO credentials')) {
          const credential = {
            id: this.nextId++,
            service: params[0] as string,
            email: params[1] as string,
            password: params[2] as string,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          this.credentials.push(credential);
          return { changes: 1, lastInsertRowid: credential.id };
        }
        return { changes: 0 };
      },
      get: (params: unknown[]) => {
        if (sql.includes('SELECT * FROM timesheet WHERE id')) {
          return this.timesheetEntries.find(e => e.id === params[0]) || null;
        }
        if (sql.includes('SELECT * FROM credentials WHERE service')) {
          return this.credentials.find(c => c.service === params[0]) || null;
        }
        return null;
      }
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    // Mock close - no actual cleanup needed for in-memory
  }

  /**
   * Get all timesheet entries (for testing)
   */
  getAllTimesheetEntries(): DbTimesheetEntry[] {
    return [...this.timesheetEntries];
  }

  /**
   * Get pending timesheet entries
   */
  getPendingTimesheetEntries(): DbTimesheetEntry[] {
    return this.timesheetEntries.filter(e => e.status === null);
  }

  /**
   * Get submitted timesheet entries
   */
  getSubmittedTimesheetEntries(): DbTimesheetEntry[] {
    return this.timesheetEntries.filter(e => e.status === 'Complete');
  }

  /**
   * Clear all data (for test cleanup)
   */
  clear(): void {
    this.timesheetEntries = [];
    this.credentials = [];
    this.nextId = 1;
  }

  /**
   * Seed with test data
   */
  seed(entries: DbTimesheetEntry[]): void {
    this.timesheetEntries = [...entries];
    this.nextId = Math.max(...entries.map(e => e.id), 0) + 1;
  }
}

/**
 * Create a new mock database instance
 */
export function createMockDatabase(): MockDatabase {
  return new MockDatabase();
}

/**
 * Mock database factory for dependency injection
 */
export class MockDatabaseFactory {
  private static instance: MockDatabase | null = null;

  static create(): MockDatabase {
    if (!this.instance) {
      this.instance = new MockDatabase();
    }
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}
