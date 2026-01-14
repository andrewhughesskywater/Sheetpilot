/**
 * @fileoverview Database Viewer IPC Handlers
 * 
 * Handles IPC communication for database viewing operations.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { ipcMain } from 'electron';
import { ipcLogger } from '@sheetpilot/shared/logger';
import { getDb } from '@/models';
import { validateSession } from '@/models';
import { isTrustedIpcSender } from './handlers/timesheet/main-window';

/**
 * Register all database viewer-related IPC handlers
 */
export function registerDatabaseHandlers(): void {
  
  // Handler for getting all timesheet entries (for database viewer) with pagination
  ipcMain.handle('database:getAllTimesheetEntries', async (event, token: string, options?: { page?: number; pageSize?: number }) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not access database: unauthorized request', entries: [], totalCount: 0 };
    }
    // Validate session
    if (!token) {
      ipcLogger.security('database-access-denied', 'Unauthorized database access attempted', { handler: 'getAllTimesheetEntries' });
      return { success: false, error: 'Session token is required. Please log in to view archive data.', entries: [], totalCount: 0 };
    }

    const session = validateSession(token);
    if (!session.valid) {
      ipcLogger.security('database-access-denied', 'Invalid session attempting database access', { handler: 'getAllTimesheetEntries', token: token.substring(0, 8) + '...' });
      return { success: false, error: 'Session is invalid or expired. Please log in again.', entries: [], totalCount: 0 };
    }

    // Pagination parameters with defaults
    const page = options?.page ?? 0;
    const pageSize = options?.pageSize ?? 100; // Default 100 entries per page
    const offset = page * pageSize;
    
    ipcLogger.verbose('Fetching timesheet entries with pagination', { 
      email: session.email,
      page,
      pageSize,
      offset
    });
    
    try {
      const db = getDb();
      
      // Get total count for pagination
      const countStmt = db.prepare('SELECT COUNT(*) as total FROM timesheet WHERE status = \'Complete\'');
      const countResult = countStmt.get() as { total: number };
      const totalCount = countResult.total;
      
      // Get paginated entries (compute hours from time_in and time_out)
      const getAll = db.prepare(`
        SELECT *, (time_out - time_in) / 60.0 as hours FROM timesheet 
        WHERE status = 'Complete' 
        ORDER BY date ASC, time_in ASC 
        LIMIT ? OFFSET ?
      `);
      const entries = getAll.all(pageSize, offset);
      
      ipcLogger.verbose('Archive timesheet entries retrieved', { 
        count: entries.length,
        totalCount,
        page,
        pageSize,
        email: session.email 
      });
      
      return { 
        success: true, 
        entries,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      };
    } catch (err: unknown) {
      ipcLogger.error('Could not get timesheet entries', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage, entries: [], totalCount: 0 };
    }
  });

  // Handler for getting all archive data (timesheet + credentials) in a single call
  ipcMain.handle('database:getAllArchiveData', async (event, token: string) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not access database: unauthorized request' };
    }
    // Validate session
    if (!token) {
      ipcLogger.security('database-access-denied', 'Unauthorized database access attempted', { handler: 'getAllArchiveData' });
      return { success: false, error: 'Session token is required. Please log in to view archive data.' };
    }

    const session = validateSession(token);
    if (!session.valid) {
      ipcLogger.security('database-access-denied', 'Invalid session attempting database access', { handler: 'getAllArchiveData', token: token.substring(0, 8) + '...' });
      return { success: false, error: 'Session is invalid or expired. Please log in again.' };
    }

    ipcLogger.verbose('Fetching all archive data (batched)', { email: session.email });
    
    try {
      const db = getDb();
      
      // Get timesheet entries (compute hours from time_in and time_out)
      const getTimesheet = db.prepare('SELECT *, (time_out - time_in) / 60.0 as hours FROM timesheet WHERE status = \'Complete\' ORDER BY date ASC, time_in ASC');
      const timesheet = getTimesheet.all();
      
      // Get credentials
      const getCredentials = db.prepare('SELECT id, service, email, created_at, updated_at FROM credentials ORDER BY service');
      const credentials = getCredentials.all();
      
      ipcLogger.verbose('Archive data retrieved', { 
        timesheetCount: timesheet.length,
        credentialsCount: credentials.length,
        email: session.email 
      });
      
      return { 
        success: true, 
        timesheet,
        credentials
      };
    } catch (err: unknown) {
      ipcLogger.error('Could not get archive data', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });
}

