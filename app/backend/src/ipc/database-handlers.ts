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
import { ipcLogger } from '../../../shared/logger';
import { getDb, validateSession } from '../services/database';

/**
 * Register all database viewer-related IPC handlers
 */
export function registerDatabaseHandlers(): void {
  
  // Handler for getting all timesheet entries (for database viewer) with pagination
  ipcMain.handle('database:getAllTimesheetEntries', async (_event, token: string, options?: { page?: number; pageSize?: number }) => {
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
      
      // Get paginated entries
      const getAll = db.prepare(`
        SELECT * FROM timesheet 
        WHERE status = 'Complete' 
        ORDER BY date DESC, time_in DESC 
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

  // Handler for getting all credentials (for database viewer)
  ipcMain.handle('database:getAllCredentials', async () => {
    ipcLogger.verbose('Fetching all credentials');
    try {
      const db = getDb();
      const getAll = db.prepare('SELECT id, service, email, created_at, updated_at FROM credentials ORDER BY service');
      const credentials = getAll.all();
      ipcLogger.verbose('Credentials retrieved', { count: credentials.length });
      return { success: true, credentials };
    } catch (err: unknown) {
      ipcLogger.error('Could not get credentials', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage, credentials: [] };
    }
  });

  // Handler for clearing the entire database (dev only)
  ipcMain.handle('database:clearDatabase', async () => {
    ipcLogger.audit('clear-database', 'User clearing entire database');
    try {
      const db = getDb();
      db.exec('DELETE FROM timesheet');
      db.exec('DELETE FROM credentials');
      ipcLogger.warn('Database cleared - all data removed');
      return { success: true, message: 'Database cleared successfully' };
    } catch (err: unknown) {
      ipcLogger.error('Could not clear database', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });
}

