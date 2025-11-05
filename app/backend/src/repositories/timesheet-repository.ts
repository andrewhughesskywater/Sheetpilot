/**
 * @fileoverview Timesheet Repository
 * 
 * Handles all timesheet-related database operations.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { dbLogger } from '../../../shared/logger';
import { getDb } from './connection-manager';

/**
 * Inserts a new timesheet entry with deduplication
 */
export function insertTimesheetEntry(entry: {
    date: string;
    timeIn: number;
    timeOut: number;
    project: string;
    tool?: string | null;
    detailChargeCode?: string | null;
    taskDescription: string;
}) {
    const timer = dbLogger.startTimer('insert-timesheet-entry');
    const db = getDb();
    
    dbLogger.verbose('Inserting timesheet entry', { 
        date: entry.date,
        project: entry.project,
        timeIn: entry.timeIn,
        timeOut: entry.timeOut
    });
    
    const insert = db.prepare(`
        INSERT INTO timesheet
          (date, time_in, time_out, project, tool, detail_charge_code, task_description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, time_in, project, task_description) DO NOTHING
    `);
    
    const result = insert.run(
        entry.date,
        entry.timeIn,
        entry.timeOut,
        entry.project,
        entry.tool || null,
        entry.detailChargeCode || null,
        entry.taskDescription
    );
    
    if (result.changes > 0) {
        dbLogger.info('Timesheet entry inserted', { 
            date: entry.date,
            project: entry.project 
        });
        timer.done({ isDuplicate: false, changes: result.changes });
        return { success: true, isDuplicate: false, changes: result.changes };
    } else {
        dbLogger.verbose('Duplicate timesheet entry skipped', { 
            date: entry.date,
            project: entry.project 
        });
        timer.done({ isDuplicate: true });
        return { success: false, isDuplicate: true, changes: 0 };
    }
}

/**
 * Gets all pending timesheet entries
 */
export function getPendingTimesheetEntries() {
    const timer = dbLogger.startTimer('get-pending-entries');
    const db = getDb();
    
    dbLogger.verbose('Fetching pending timesheet entries');
    const getPending = db.prepare(`
        SELECT * FROM timesheet 
        WHERE status IS NULL
        ORDER BY date, time_in
    `);
    
    const entries = getPending.all();
    dbLogger.verbose('Pending entries retrieved', { count: entries.length });
    timer.done({ count: entries.length });
    return entries;
}

/**
 * Marks timesheet entries as in-progress
 */
export function markTimesheetEntriesAsInProgress(ids: number[]) {
    if (ids.length === 0) {
        dbLogger.debug('No entries to mark as in-progress');
        return;
    }
    
    const timer = dbLogger.startTimer('mark-entries-in-progress');
    const db = getDb();
    
    dbLogger.info('Marking timesheet entries as in-progress', { count: ids.length, ids });
    const placeholders = ids.map(() => '?').join(',');
    const updateInProgress = db.prepare(`
        UPDATE timesheet 
        SET status = 'in_progress'
        WHERE id IN (${placeholders}) AND status IS NULL
    `);
    
    const result = updateInProgress.run(...ids);
    dbLogger.audit('mark-in-progress', 'Entries marked as in-progress', { 
        count: ids.length,
        changes: result.changes 
    });
    timer.done({ count: ids.length, changes: result.changes });
}

/**
 * Resets timesheet entries status back to NULL
 */
export function resetTimesheetEntriesStatus(ids: number[]) {
    if (ids.length === 0) {
        dbLogger.debug('No entries to reset status');
        return;
    }
    
    const timer = dbLogger.startTimer('reset-entries-status');
    const db = getDb();
    
    dbLogger.info('Resetting timesheet entries to NULL status', { count: ids.length, ids });
    const placeholders = ids.map(() => '?').join(',');
    const resetStatus = db.prepare(`
        UPDATE timesheet 
        SET status = NULL
        WHERE id IN (${placeholders})
    `);
    
    const result = resetStatus.run(...ids);
    dbLogger.audit('reset-status', 'Entries status reset to NULL', { 
        count: ids.length,
        changes: result.changes 
    });
    timer.done({ count: ids.length, changes: result.changes });
}

/**
 * Marks timesheet entries as successfully submitted
 */
export function markTimesheetEntriesAsSubmitted(ids: number[]) {
    if (ids.length === 0) {
        dbLogger.debug('No entries to mark as submitted');
        return;
    }
    
    const timer = dbLogger.startTimer('mark-entries-submitted');
    const db = getDb();
    
    dbLogger.info('Marking timesheet entries as submitted', { count: ids.length, ids });
    const placeholders = ids.map(() => '?').join(',');
    const updateSubmitted = db.prepare(`
        UPDATE timesheet 
        SET status = 'Complete', 
            submitted_at = datetime('now')
        WHERE id IN (${placeholders})
    `);
    
    const result = updateSubmitted.run(...ids);
    dbLogger.audit('mark-submitted', 'Entries marked as submitted', { 
        count: ids.length,
        changes: result.changes 
    });
    timer.done({ count: ids.length, changes: result.changes });
}

/**
 * Reverts failed timesheet entries back to pending status
 */
export function removeFailedTimesheetEntries(ids: number[]) {
    if (ids.length === 0) {
        dbLogger.debug('No failed entries to revert');
        return;
    }
    
    const timer = dbLogger.startTimer('revert-failed-entries');
    const db = getDb();
    
    dbLogger.warn('Reverting failed timesheet entries back to pending', { count: ids.length, ids });
    const placeholders = ids.map(() => '?').join(',');
    const revertFailed = db.prepare(`
        UPDATE timesheet 
        SET status = NULL
        WHERE id IN (${placeholders})
    `);
    
    const result = revertFailed.run(...ids);
    dbLogger.audit('revert-failed', 'Failed entries reverted to pending status', { 
        count: ids.length,
        changes: result.changes 
    });
    timer.done({ count: ids.length, changes: result.changes });
}

/**
 * Gets timesheet entries by their IDs
 */
export function getTimesheetEntriesByIds(ids: number[]) {
    if (ids.length === 0) return [];
    
    const db = getDb();
    
    const placeholders = ids.map(() => '?').join(',');
    const getByIds = db.prepare(`
        SELECT * FROM timesheet 
        WHERE id IN (${placeholders})
        ORDER BY date, time_in
    `);
    
    return getByIds.all(...ids);
}

/**
 * Gets all submitted timesheet entries for CSV export
 */
export function getSubmittedTimesheetEntriesForExport() {
    const timer = dbLogger.startTimer('get-submitted-entries-export');
    const db = getDb();
    
    dbLogger.verbose('Fetching submitted timesheet entries for export');
    const getSubmitted = db.prepare(`
        SELECT 
            date,
            time_in,
            time_out,
            hours,
            project,
            tool,
            detail_charge_code,
            task_description,
            status,
            submitted_at
        FROM timesheet 
        WHERE status = 'Complete'
        ORDER BY date DESC, time_in DESC
    `);
    
    const entries = getSubmitted.all();
    dbLogger.verbose('Submitted entries retrieved for export', { count: entries.length });
    timer.done({ count: entries.length });
    return entries;
}

