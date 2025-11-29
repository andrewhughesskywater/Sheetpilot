/**
 * @fileoverview Timesheet IPC Handlers
 * 
 * Handles IPC communication for timesheet operations.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { ipcMain, BrowserWindow } from 'electron';
import { ipcLogger } from '../../../shared/logger';
import { 
  getDb,
  getDbPath,
  getPendingTimesheetEntries,
  validateSession,
  resetInProgressTimesheetEntries
} from '../services/database';
import { getCredentials } from '../services/database';
import { submitTimesheets } from '../services/timesheet-importer';
import { validateInput } from '../validation/validate-ipc-input';
import { 
  saveDraftSchema,
  deleteDraftSchema
} from '../validation/ipc-schemas';
import {
  createUserFriendlyMessage,
  extractErrorCode
} from '../../../shared/errors';

// Utility functions
function parseTimeToMinutes(timeStr: string): number {
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

function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Global flag to prevent concurrent timesheet submissions
let isSubmissionInProgress = false;

// Global abort controller for cancellation support
let currentSubmissionAbortController: AbortController | null = null;

/**
 * Get main window reference (passed in from main.ts)
 */
let mainWindowRef: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindowRef = window;
}

/**
 * Register all timesheet-related IPC handlers
 */
export function registerTimesheetHandlers(): void {
  
  // Handler for timesheet submission (submit pending data from database)
  ipcMain.handle('timesheet:submit', async (_event, token: string, useMockWebsite?: boolean) => {
    ipcLogger.verbose('Timesheet submit IPC handler called');
    const timer = ipcLogger.startTimer('timesheet-submit');
    
    // Check if submission is already in progress
    if (isSubmissionInProgress) {
      ipcLogger.warn('Submission already in progress, rejecting concurrent request');
      timer.done({ outcome: 'error', reason: 'concurrent-submission-blocked' });
      return { 
        error: 'A submission is already in progress. Please wait for it to complete.'
      };
    }
    
    ipcLogger.info('Timesheet submission initiated by user');
    
    try {
      // Set flag to block concurrent submissions
      isSubmissionInProgress = true;
      
      // Create abort controller for this submission
      currentSubmissionAbortController = new AbortController();
      
      // Validate session and check if admin
      if (!token) {
        timer.done({ outcome: 'error', reason: 'no-session' });
        return { 
          error: 'Session token is required. Please log in to submit timesheets.'
        };
      }

      const session = validateSession(token);
      if (!session.valid) {
        timer.done({ outcome: 'error', reason: 'invalid-session' });
        return { 
          error: 'Session is invalid or expired. Please log in again.'
        };
      }

      // Reject submission if admin
      if (session.isAdmin) {
        ipcLogger.warn('Admin attempted timesheet submission', { email: session.email });
        timer.done({ outcome: 'error', reason: 'admin-not-allowed' });
        return { 
          error: 'Admin users cannot submit timesheet entries to SmartSheet.'
        };
      }

      ipcLogger.verbose('Checking credentials for submission', { service: 'smartsheet' });
      // Check credentials for submission
      const credentials = getCredentials('smartsheet');
      ipcLogger.verbose('Credentials check result', { 
        service: 'smartsheet',
        found: !!credentials
      });
      
      if (!credentials) {
        ipcLogger.warn('Submission: credentials not found', { service: 'smartsheet' });
        timer.done({ outcome: 'error', reason: 'credentials-not-found' });
        return { 
          error: 'SmartSheet credentials not found. Please add your credentials to submit timesheets.'
        };
      }

      ipcLogger.verbose('Credentials retrieved, proceeding with submission', { 
        service: 'smartsheet',
        email: credentials.email 
      });
      ipcLogger.verbose('Calling submitTimesheets function');
      
      // Track last progress time for timeout detection
      let lastProgressTime = Date.now();
      let timeoutCheckInterval: NodeJS.Timeout | null = null;
      let submissionAborted = false;
      let pendingEntryIds: number[] = [];
      
      // Get pending entry IDs before submission for timeout recovery
      const pendingEntries = getPendingTimesheetEntries() as Array<{ id: number }>;
      pendingEntryIds = pendingEntries.map(e => e.id);
      
      // Create progress callback that sends IPC events and updates timeout timer
      const progressCallback = (percent: number, message: string) => {
        lastProgressTime = Date.now();
        
        const progressData = {
          percent: Math.min(100, Math.max(0, percent)),
          current: Math.floor((percent / 100) * pendingEntryIds.length),
          total: pendingEntryIds.length,
          message
        };
        
        // Send progress to renderer
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('timesheet:progress', progressData);
        }
        
        ipcLogger.verbose('Submission progress update', progressData);
      };
      
      // Set up 5-minute timeout checker (checks every 30 seconds)
      timeoutCheckInterval = setInterval(() => {
        const timeSinceLastProgress = Date.now() - lastProgressTime;
        const fiveMinutes = 5 * 60 * 1000; // 300000ms
        
        if (timeSinceLastProgress > fiveMinutes && !submissionAborted) {
          submissionAborted = true;
          ipcLogger.error('Submission timeout: no progress for 5 minutes', {
            timeSinceLastProgress,
            lastProgressTime: new Date(lastProgressTime).toISOString()
          });
          
          // Reset entry status back to NULL (pending)
          if (pendingEntryIds.length > 0) {
            const { resetTimesheetEntriesStatus } = require('../services/database');
            resetTimesheetEntriesStatus(pendingEntryIds);
            ipcLogger.info('Reset entry status to pending after timeout', { count: pendingEntryIds.length });
          }
          
          // Clear interval
          if (timeoutCheckInterval) {
            clearInterval(timeoutCheckInterval);
            timeoutCheckInterval = null;
          }
        }
      }, 30000); // Check every 30 seconds
      
      try {
        // Submit pending data from database with progress callback
        const submitResult = await submitTimesheets(
          credentials.email, 
          credentials.password, 
          progressCallback,
          currentSubmissionAbortController?.signal,
          useMockWebsite
        );
        ipcLogger.info('submitTimesheets completed', { 
          ok: submitResult.ok,
          successCount: submitResult.successCount,
          totalProcessed: submitResult.totalProcessed
        });
        
        // Clear timeout checker on completion
        if (timeoutCheckInterval) {
          clearInterval(timeoutCheckInterval);
          timeoutCheckInterval = null;
        }
        
        // Check if submission was aborted by timeout
        if (submissionAborted) {
          ipcLogger.warn('Submission was aborted by timeout', { submitResult });
          return {
            error: 'Submission timed out after 5 minutes of no progress. Entries have been reset to pending status. Please try again.'
          };
        }
        
        // Check if submission was successful
        if (!submitResult.ok) {
          ipcLogger.warn('Timesheet submission failed', { 
            submitResult,
            successCount: submitResult.successCount,
            removedCount: submitResult.removedCount,
            totalProcessed: submitResult.totalProcessed
          });
        }
        
        ipcLogger.info('Timesheet submission completed successfully', { 
          submitResult,
          dbPath: getDbPath() 
        });
        timer.done({ outcome: 'success', submitResult });
        
        return { 
          submitResult,
          dbPath: getDbPath() 
        };
      } catch (submissionErr: unknown) {
        // Clear timeout checker on error
        if (timeoutCheckInterval) {
          clearInterval(timeoutCheckInterval);
          timeoutCheckInterval = null;
        }
        throw submissionErr;
      }
    } catch (err: unknown) {
      const errorCode = extractErrorCode(err);
      const errorMessage = createUserFriendlyMessage(err);
      const errorDetails = err instanceof Error ? {
        code: errorCode,
        message: errorMessage,
        name: err.name,
        stack: err.stack
      } : { code: errorCode, message: errorMessage };
      
      ipcLogger.error('Timesheet submission failed', errorDetails);
      timer.done({ outcome: 'error', errorCode });
      
      return { error: errorMessage };
    } finally {
      // Always clear the submission lock and abort controller
      isSubmissionInProgress = false;
      currentSubmissionAbortController = null;
    }
  });

  // Handler for cancelling timesheet submission
  ipcMain.handle('timesheet:cancel', async () => {
    ipcLogger.info('Timesheet cancellation requested');
    
    if (!isSubmissionInProgress) {
      ipcLogger.warn('No submission in progress to cancel');
      return { success: false, error: 'No submission in progress' };
    }
    
    if (!currentSubmissionAbortController) {
      ipcLogger.warn('No abort controller available');
      return { success: false, error: 'Cannot cancel submission' };
    }
    
    try {
      // Abort the current submission
      currentSubmissionAbortController.abort();
      ipcLogger.info('Submission cancelled successfully');
      
      // Reset the in-progress entries back to pending
      const { resetInProgressTimesheetEntries } = require('../services/database');
      const resetCount = resetInProgressTimesheetEntries();
      ipcLogger.info('Reset in-progress entries to pending', { count: resetCount });
      
      return { success: true, message: 'Submission cancelled' };
    } catch (err: unknown) {
      ipcLogger.error('Could not cancel submission', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Handler for saving draft timesheet entries
  ipcMain.handle('timesheet:saveDraft', async (_event, row: {
    id?: number;
    date: string;
    timeIn: string;
    timeOut: string;
    project: string;
    tool?: string | null;
    chargeCode?: string | null;
    taskDescription: string;
  }) => {
    const timer = ipcLogger.startTimer('save-draft');
    
    // Validate input using Zod schema
    const validation = validateInput(saveDraftSchema, row, 'timesheet:saveDraft');
    if (!validation.success) {
      timer.done({ outcome: 'error', error: 'validation-failed' });
      return { success: false, error: validation.error };
    }
    
    const validatedRow = validation.data!;
    
    try {
      ipcLogger.verbose('Saving draft timesheet entry', { 
        id: validatedRow.id,
        date: validatedRow.date,
        project: validatedRow.project 
      });
      
      // Convert time strings (HH:mm) to minutes since midnight
      const timeInMinutes = parseTimeToMinutes(validatedRow.timeIn);
      const timeOutMinutes = parseTimeToMinutes(validatedRow.timeOut);
      
      ipcLogger.debug('Parsed time values', { 
        timeIn: validatedRow.timeIn,
        timeInMinutes,
        timeOut: validatedRow.timeOut,
        timeOutMinutes 
      });
      
      // Note: Quarter validation happens during submission routing, not at save time
      // This allows users to enter historical data from any quarter
      
      // Validate times are 15-minute increments
      if (timeInMinutes % 15 !== 0 || timeOutMinutes % 15 !== 0) {
        throw new Error('Times must be in 15-minute increments');
      }
      
      // Validate timeOut > timeIn (already validated by schema, but double-check)
      if (timeOutMinutes <= timeInMinutes) {
        throw new Error('Time Out must be after Time In');
      }
      
      const db = getDb();
      let result;
      let savedId: number;
      
      // If row has an id, UPDATE the existing row
      if (validatedRow.id !== undefined && validatedRow.id !== null) {
        ipcLogger.debug('Updating existing timesheet entry', { id: validatedRow.id });
        
        // CRITICAL: Only update entries with status=NULL (pending drafts)
        // Do NOT update entries that have been submitted (status='in_progress' or 'Complete')
        // This prevents batch saves from overwriting successfully submitted entries
        const update = db.prepare(`
          UPDATE timesheet
          SET date = ?,
              time_in = ?,
              time_out = ?,
              project = ?,
              tool = ?,
              detail_charge_code = ?,
              task_description = ?
          WHERE id = ? AND status IS NULL
        `);
        
        result = update.run(
          validatedRow.date,
          timeInMinutes,
          timeOutMinutes,
          validatedRow.project,
          validatedRow.tool || null,
          validatedRow.chargeCode || null,
          validatedRow.taskDescription,
          validatedRow.id
        );
        savedId = validatedRow.id;
      } else {
        // If no id, INSERT a new row (with deduplication)
        ipcLogger.debug('Inserting new timesheet entry');
        const insert = db.prepare(`
          INSERT INTO timesheet
          (date, time_in, time_out, project, tool, detail_charge_code, task_description, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(date, time_in, project, task_description) DO UPDATE SET
            time_out = excluded.time_out,
            tool = excluded.tool,
            detail_charge_code = excluded.detail_charge_code
          WHERE status IS NULL
        `);
        
        result = insert.run(
          validatedRow.date,
          timeInMinutes,
          timeOutMinutes,
          validatedRow.project,
          validatedRow.tool || null,
          validatedRow.chargeCode || null,
        validatedRow.taskDescription
      );
      
      // Get the ID of the saved row
      // For INSERT, use lastInsertRowid; for ON CONFLICT DO UPDATE, query the row
      if (result.changes > 0 && (result as { lastInsertRowid?: number }).lastInsertRowid) {
        // New insert - use lastInsertRowid
        savedId = (result as { lastInsertRowid: number }).lastInsertRowid;
      } else {
        // ON CONFLICT DO UPDATE case or no changes - query to get the existing ID
        const getSaved = db.prepare(`
          SELECT id FROM timesheet 
          WHERE date = ? AND time_in = ? AND project = ? AND task_description = ? AND status IS NULL
          LIMIT 1
        `);
        const savedRow = getSaved.get(
          validatedRow.date,
          timeInMinutes,
          validatedRow.project,
          validatedRow.taskDescription
        ) as { id: number } | undefined;
        savedId = savedRow?.id ?? 0;
      }
    }
    
    // Fetch the complete saved entry to return to frontend
    const getEntry = db.prepare(`SELECT * FROM timesheet WHERE id = ?`);
    const savedEntry = getEntry.get(savedId) as {
      id: number;
      date: string;
      time_in: number;
      time_out: number;
      project: string;
      tool?: string | null;
      detail_charge_code?: string | null;
      task_description: string;
    } | undefined;
    
    ipcLogger.info('Draft timesheet entry saved', {
        id: savedId,
        changes: result.changes,
        date: validatedRow.date,
        project: validatedRow.project 
      });
      timer.done({ changes: result.changes });
      
      if (savedEntry) {
        // Return the saved entry in grid format
        return { 
          success: true, 
          changes: result.changes,
          id: savedId,
          entry: {
            id: savedEntry.id,
            date: savedEntry.date,
            timeIn: formatMinutesToTime(savedEntry.time_in),
            timeOut: formatMinutesToTime(savedEntry.time_out),
            project: savedEntry.project,
            tool: savedEntry.tool || null,
            chargeCode: savedEntry.detail_charge_code || null,
            taskDescription: savedEntry.task_description
          }
        };
      }
      
      return { success: true, changes: result.changes, id: savedId };
    } catch (err: unknown) {
      ipcLogger.error('Could not save draft timesheet entry', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  // Handler for deleting draft timesheet entries
  ipcMain.handle('timesheet:deleteDraft', async (_event, id: number) => {
    const timer = ipcLogger.startTimer('delete-draft');
    
    // Validate input using Zod schema
    const validation = validateInput(deleteDraftSchema, { id }, 'timesheet:deleteDraft');
    if (!validation.success) {
      return { success: false, error: validation.error };
    }
    
    const validatedData = validation.data!;

    try {
      ipcLogger.verbose('Deleting timesheet entry', { id: validatedData.id });
      
      const db = getDb();
      
      // Check current status before deleting
      const checkStmt = db.prepare(`SELECT id, status FROM timesheet WHERE id = ?`);
      const entry = checkStmt.get(validatedData.id) as { id: number; status: string | null } | undefined;
      
      if (entry) {
        ipcLogger.info('Deleting entry with status', { id: validatedData.id, status: entry.status });
      }
      
      // Delete ANY entry when user explicitly removes it from Handsontable
      // This allows users to delete submitted entries if they made a mistake
      const deleteStmt = db.prepare(`
        DELETE FROM timesheet 
        WHERE id = ?
      `);
      
      const result = deleteStmt.run(validatedData.id);
      
      if (result.changes === 0) {
        ipcLogger.warn('Entry not found to delete', { id: validatedData.id });
        timer.done({ outcome: 'not_found' });
        return { success: false, error: 'Entry not found' };
      }
      
      ipcLogger.info('Timesheet entry deleted', { 
        id: validatedData.id,
        changes: result.changes,
        previousStatus: entry?.status
      });
      timer.done({ changes: result.changes });
      return { success: true };
    } catch (err: unknown) {
      ipcLogger.error('Could not delete timesheet entry', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  // Handler for loading draft timesheet entries (pending only)
  ipcMain.handle('timesheet:loadDraft', async () => {
    const timer = ipcLogger.startTimer('load-draft');
    try {
      // Reset any "in_progress" entries to NULL on page reload
      // This handles cases where the app crashed or was closed during submission
      const resetCount = resetInProgressTimesheetEntries();
      if (resetCount > 0) {
        ipcLogger.info('Reset in-progress entries to NULL on page reload', { count: resetCount });
      }
      
      ipcLogger.verbose('Loading draft timesheet entries');
      
      const db = getDb();
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
      const gridData = entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        timeIn: formatMinutesToTime(entry.time_in),
        timeOut: formatMinutesToTime(entry.time_out),
        project: entry.project,
        tool: entry.tool || null,
        chargeCode: entry.detail_charge_code || null,
        taskDescription: entry.task_description
      }));
      
      ipcLogger.info('Draft timesheet entries loaded', { count: gridData.length });
      timer.done({ count: gridData.length });
      
      // Return one blank row if no entries, otherwise return the entries
      const entriesToReturn = gridData.length > 0 ? gridData : [{}];
      return { success: true, entries: entriesToReturn };
    } catch (err: unknown) {
      ipcLogger.error('Could not load draft timesheet entries', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage, entries: [] };
    }
  });

  // Handler for loading a single draft timesheet entry by ID
  ipcMain.handle('timesheet:loadDraftById', async (_event, id: number) => {
    const timer = ipcLogger.startTimer('load-draft-by-id');
    try {
      if (!id || typeof id !== 'number') {
        timer.done({ outcome: 'error', error: 'invalid-id' });
        return { success: false, error: 'Invalid ID provided' };
      }

      ipcLogger.verbose('Loading draft timesheet entry by ID', { id });
      
      const db = getDb();
      const getEntry = db.prepare(`
        SELECT * FROM timesheet 
        WHERE id = ? AND status IS NULL
      `);
      
      const entry = getEntry.get(id) as {
        id: number;
        date: string;
        time_in: number;
        time_out: number;
        project: string;
        tool?: string | null;
        detail_charge_code?: string | null;
        task_description: string;
      } | undefined;
      
      if (!entry) {
        ipcLogger.warn('Draft timesheet entry not found', { id });
        timer.done({ outcome: 'not-found' });
        return { success: false, error: 'Entry not found or already submitted' };
      }
      
      // Convert database format to grid format
      const gridEntry = {
        id: entry.id,
        date: entry.date,
        timeIn: formatMinutesToTime(entry.time_in),
        timeOut: formatMinutesToTime(entry.time_out),
        project: entry.project,
        tool: entry.tool || null,
        chargeCode: entry.detail_charge_code || null,
        taskDescription: entry.task_description
      };
      
      ipcLogger.verbose('Draft timesheet entry loaded by ID', { id });
      timer.done({ found: true });
      return { success: true, entry: gridEntry };
    } catch (err: unknown) {
      ipcLogger.error('Could not load draft timesheet entry by ID', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  // DEV ONLY: Handler for simulating successful submission (marks all pending entries as complete)
  ipcMain.handle('timesheet:devSimulateSuccess', async () => {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      ipcLogger.warn('Dev simulate success called in production - blocking');
      return { success: false, error: 'Not available in production' };
    }
    
    ipcLogger.info('[DEV] Simulating successful submission');
    
    try {
      const db = getDb();
      
      // Get all pending entries
      const getPending = db.prepare(`
        SELECT id FROM timesheet WHERE status IS NULL
      `);
      const pendingEntries = getPending.all() as Array<{ id: number }>;
      
      if (pendingEntries.length === 0) {
        ipcLogger.info('[DEV] No pending entries to mark as complete');
        return { success: true, count: 0 };
      }
      
      const ids = pendingEntries.map(e => e.id);
      const placeholders = ids.map(() => '?').join(',');
      
      // Mark all pending entries as Complete with current timestamp
      const markComplete = db.prepare(`
        UPDATE timesheet 
        SET status = 'Complete',
            submitted_at = datetime('now')
        WHERE id IN (${placeholders})
      `);
      
      const result = markComplete.run(...ids);
      
      ipcLogger.info('[DEV] Marked entries as Complete', { 
        count: result.changes,
        ids 
      });
      
      return { success: true, count: result.changes };
    } catch (err: unknown) {
      ipcLogger.error('[DEV] Could not simulate success', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Handler for resetting in-progress entries
  ipcMain.handle('timesheet:resetInProgress', async () => {
    const timer = ipcLogger.startTimer('reset-in-progress');
    try {
      ipcLogger.info('Resetting in-progress entries to NULL status');
      const resetCount = resetInProgressTimesheetEntries();
      ipcLogger.info('Reset in-progress entries completed', { count: resetCount });
      timer.done({ count: resetCount });
      return { success: true, count: resetCount };
    } catch (err: unknown) {
      ipcLogger.error('Could not reset in-progress entries', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  // Handler for CSV export
  ipcMain.handle('timesheet:exportToCSV', async () => {
    ipcLogger.verbose('Exporting timesheet data to CSV');
    try {
      const { getSubmittedTimesheetEntriesForExport } = await import('../services/database');
      const entries = getSubmittedTimesheetEntriesForExport();
      
      if (entries.length === 0) {
        return {
          success: false,
          error: 'No submitted timesheet entries found to export'
        };
      }

      // Format time from minutes to HH:MM
      const formatTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      };

      // CSV headers
      const headers = [
        'Date',
        'Start Time',
        'End Time', 
        'Hours',
        'Project',
        'Tool',
        'Charge Code',
        'Task Description',
        'Status',
        'Submitted At'
      ];

      // Convert data to CSV format
      const csvRows = [headers.join(',')];
      
      for (const entry of entries) {
        // Type assertion to access properties safely
        const typedEntry = entry as {
          date: string;
          time_in: number;
          time_out: number;
          hours: number;
          project: string;
          tool?: string;
          detail_charge_code?: string;
          task_description: string;
          status: string;
          submitted_at: string;
        };
        
        const row = [
          typedEntry.date,
          formatTime(typedEntry.time_in),
          formatTime(typedEntry.time_out),
          typedEntry.hours,
          `"${typedEntry.project.replace(/"/g, '""')}"`, // Escape quotes in project name
          `"${(typedEntry.tool || '').replace(/"/g, '""')}"`, // Escape quotes in tool
          `"${(typedEntry.detail_charge_code || '').replace(/"/g, '""')}"`, // Escape quotes in charge code
          `"${typedEntry.task_description.replace(/"/g, '""')}"`, // Escape quotes in task description
          typedEntry.status,
          typedEntry.submitted_at
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');
      
      ipcLogger.info('CSV export completed', { 
        entryCount: entries.length,
        csvSize: csvContent.length 
      });

      return {
        success: true,
        csvData: csvContent,
        csvContent, // Keep for backward compatibility
        entryCount: entries.length,
        filename: `timesheet_export_${new Date().toISOString().split('T')[0]}.csv`
      };
    } catch (err: unknown) {
      ipcLogger.error('Could not export CSV', err);
      const errorMessage = err instanceof Error ? err.message : 'Could not export timesheet data';
      return {
        success: false,
        error: errorMessage
      };
    }
  });
}

