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

export interface TimesheetDedupKey {
    date: string;
    timeIn: number;
    project: string;
    taskDescription: string;
}

export interface TimesheetBulkInsertEntry {
    date: string;
    timeIn: number;
    timeOut: number;
    project: string;
    tool?: string | null;
    detailChargeCode?: string | null;
    taskDescription: string;
}

export interface TimesheetDbRow {
    id: number;
    date: string;
    time_in: number;
    time_out: number;
    hours?: number;
    project: string;
    tool?: string | null;
    detail_charge_code?: string | null;
    task_description: string;
    status?: string | null;
    submitted_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

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
 * Checks if a timesheet entry would be a duplicate
 */
export function checkDuplicateEntry(entry: TimesheetDedupKey): boolean {
    const db = getDb();
    const checkDuplicate = db.prepare(`
        SELECT COUNT(*) as count 
        FROM timesheet 
        WHERE date = ? AND time_in = ? AND project = ? AND task_description = ?
    `);

    const result = checkDuplicate.get(entry.date, entry.timeIn, entry.project, entry.taskDescription) as { count: number } | undefined;
    return (result?.count ?? 0) > 0;
}

/**
 * Gets all duplicate entries for a given date range
 */
export function getDuplicateEntries(startDate?: string, endDate?: string): Array<{
    date: string;
    time_in: number;
    project: string;
    task_description: string;
    count: number;
}> {
    const db = getDb();
    let query = `
        SELECT date, time_in, project, task_description, COUNT(*) as count
        FROM timesheet 
        GROUP BY date, time_in, project, task_description
        HAVING COUNT(*) > 1
    `;

    const params: Array<string> = [];
    if (startDate) {
        query += ` AND date >= ?`;
        params.push(startDate);
    }
    if (endDate) {
        query += ` AND date <= ?`;
        params.push(endDate);
    }
    query += ` ORDER BY date, time_in`;

    const getDuplicates = db.prepare(query);
    return getDuplicates.all(...params) as Array<{
        date: string;
        time_in: number;
        project: string;
        task_description: string;
        count: number;
    }>;
}

/**
 * Inserts multiple timesheet entries with deduplication in a single transaction
 */
export function insertTimesheetEntries(entries: TimesheetBulkInsertEntry[]): {
    success: boolean;
    total: number;
    inserted: number;
    duplicates: number;
    errors: number;
    errorMessage?: string;
} {
    const timer = dbLogger.startTimer('insert-timesheet-entries-bulk');
    const db = getDb();

    try {
        dbLogger.info('Starting bulk insert of timesheet entries', { count: entries.length });

        const insert = db.prepare(`
            INSERT INTO timesheet
              (date, time_in, time_out, project, tool, detail_charge_code, task_description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, time_in, project, task_description) DO NOTHING
        `);

        let inserted = 0;
        let duplicates = 0;

        const insertMany = db.transaction((entriesList: TimesheetBulkInsertEntry[]) => {
            for (const entry of entriesList) {
                const result = insert.run(
                    entry.date,
                    entry.timeIn,
                    entry.timeOut,
                    entry.project,
                    entry.tool ?? null,
                    entry.detailChargeCode ?? null,
                    entry.taskDescription
                );
                if (result.changes > 0) {
                    inserted++;
                } else {
                    duplicates++;
                }
            }
        });

        insertMany(entries);

        dbLogger.info('Bulk insert completed', {
            total: entries.length,
            inserted,
            duplicates
        });
        timer.done({ inserted, duplicates });

        return {
            success: true,
            total: entries.length,
            inserted,
            duplicates,
            errors: 0
        };
    } catch (error: unknown) {
        dbLogger.error('Bulk insert failed', error);
        timer.done({ outcome: 'error' });
        return {
            success: false,
            total: entries.length,
            inserted: 0,
            duplicates: 0,
            errors: entries.length,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Gets all pending timesheet entries
 */
export function getPendingTimesheetEntries(): TimesheetDbRow[] {
    const timer = dbLogger.startTimer('get-pending-entries');
    const db = getDb();
    
    dbLogger.verbose('Fetching pending timesheet entries');
    const getPending = db.prepare(`
        SELECT * FROM timesheet 
        WHERE status IS NULL
        ORDER BY date, time_in
    `);
    
    const entries = getPending.all() as TimesheetDbRow[];
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

    const tx = db.transaction((entryIds: readonly number[]) => {
        const updateSubmitted = db.prepare(`
            UPDATE timesheet 
            SET status = 'Complete', 
                submitted_at = datetime('now')
            WHERE id IN (${placeholders})
              AND (status IS NULL OR status = 'in_progress')
        `);

        const result = updateSubmitted.run(...entryIds);

        if (result.changes !== entryIds.length) {
            const errorMessage = `Database update mismatch: expected ${entryIds.length} rows, updated ${result.changes} rows`;
            dbLogger.error('Could not mark timesheet entries as submitted', {
                expected: entryIds.length,
                updated: result.changes,
                ids: [...entryIds]
            });
            throw new Error(errorMessage);
        }

        return result.changes;
    });

    const changes = tx(ids);
    dbLogger.audit('mark-submitted', 'Entries marked as submitted', {
        count: ids.length,
        changes
    });
    timer.done({ count: ids.length, changes });
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

    const tx = db.transaction((entryIds: readonly number[]) => {
        const revertFailed = db.prepare(`
            UPDATE timesheet 
            SET status = NULL
            WHERE id IN (${placeholders})
              AND status = 'in_progress'
        `);

        const result = revertFailed.run(...entryIds);

        if (result.changes !== entryIds.length) {
            const errorMessage = `Database update mismatch: expected ${entryIds.length} rows, updated ${result.changes} rows`;
            dbLogger.error('Could not revert failed timesheet entries', {
                expected: entryIds.length,
                updated: result.changes,
                ids: [...entryIds]
            });
            throw new Error(errorMessage);
        }

        return result.changes;
    });

    const changes = tx(ids);
    dbLogger.audit('revert-failed', 'Failed entries reverted to pending status', {
        count: ids.length,
        changes
    });
    timer.done({ count: ids.length, changes });
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

/**
 * Resets all in-progress timesheet entries back to NULL status
 * Used for recovery after failed submissions
 */
export function resetInProgressTimesheetEntries(): number {
    const timer = dbLogger.startTimer('reset-in-progress-entries');
    const db = getDb();
    
    dbLogger.info('Resetting all in-progress timesheet entries to NULL status');
    const resetStatus = db.prepare(`
        UPDATE timesheet 
        SET status = NULL
        WHERE status = 'in_progress'
    `);
    
    const result = resetStatus.run();
    dbLogger.audit('reset-in-progress-status', 'In-progress entries reset to NULL', { 
        changes: result.changes 
    });
    
    timer.done({ changes: result.changes });
    return result.changes;
}

