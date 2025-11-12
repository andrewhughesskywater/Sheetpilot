/**
 * @fileoverview Timesheet Submission Module
 * 
 * This module provides functionality to submit timesheet data using browser automation.
 * It handles data conversion, validation, and submission to external services.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { 
    ensureSchema, 
    getPendingTimesheetEntries,
    markTimesheetEntriesAsInProgress,
    markTimesheetEntriesAsSubmitted,
    removeFailedTimesheetEntries,
    getTimesheetEntriesByIds
} from './database';
import { botLogger } from '../../../shared/logger';
import { getSubmissionService } from '../middleware/bootstrap-plugins';
import type { TimesheetEntry } from '../../../shared/contracts/IDataService';
import type { Credentials } from '../../../shared/contracts/ICredentialService';
import type { SubmissionResult, ISubmissionService } from '../../../shared/contracts/ISubmissionService';
// Dynamic import to avoid top-level async operations during module loading







/**
 * Database row type for timesheet entries
 */
type DbRow = {
    id: number;
    date: string;
    time_in: number;
    time_out: number;
    project: string;
    tool?: string | null;
    detail_charge_code?: string | null;
    task_description: string;
    status?: string | null;
    submitted_at?: string | null;
};

/**
 * Result object for timesheet submission operations
 * Re-export the contract type for backward compatibility
 */
export type { SubmissionResult } from '../../../shared/contracts/ISubmissionService';

/**
 * Converts database row format to TimesheetEntry format
 */
function toTimesheetEntry(dbRow: DbRow): TimesheetEntry {
    // Convert time from minutes (0-1440) to HH:MM format
    const formatTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };
    
    // Convert date from MM/DD/YYYY to YYYY-MM-DD format for quarter matching
    let dateStr = dbRow.date;
    if (dateStr && dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
            dateStr = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
    }
    
    return {
        id: dbRow.id,
        date: dateStr,
        timeIn: formatTime(dbRow.time_in),
        timeOut: formatTime(dbRow.time_out),
        project: dbRow.project,
        tool: dbRow.tool ?? null,
        chargeCode: dbRow.detail_charge_code ?? null,
        taskDescription: dbRow.task_description
    };
}

/**
 * Submits all pending timesheet entries using the automation bot
 * 
 * This function:
 * 1. Fetches pending rows from the database
 * 2. Groups entries by quarter based on their date
 * 3. For each quarter, configures the bot with the appropriate form URL/ID
 * 4. Runs the automation bot to submit each quarter's entries
 * 5. Updates the database with results (success/error status)
 * 
 * @param email - Email for authentication
 * @param password - Password for authentication
 * @param progressCallback - Optional callback for progress updates
 * @param abortSignal - Optional abort signal for cancellation support
 * @returns Promise with submission results
 * 
 * @example
 * const result = await submitTimesheets('user@company.com', 'password123');
 * console.log(`Submitted ${result.successCount} entries, ${result.errorCount} errors`);
 */
export async function submitTimesheets(email: string, password: string, progressCallback?: (percent: number, message: string) => void, abortSignal?: AbortSignal): Promise<SubmissionResult> {
    const timer = botLogger.startTimer('submit-timesheets');
    botLogger.info('Starting automated timesheet submission', { email });
    
    // Ensure database schema is up to date
    ensureSchema();
    
    // Fetch pending rows from database
    const dbRows = getPendingTimesheetEntries() as DbRow[];
    botLogger.verbose('Pending timesheet entries retrieved', { count: dbRows.length });
    botLogger.debug('Pending entry details', { 
        entries: dbRows.map(r => ({ id: r.id, date: r.date, status: r.status }))
    });
    
    if (dbRows.length === 0) {
        botLogger.info('No pending timesheet entries to submit');
        timer.done({ totalProcessed: 0, successCount: 0 });
        return {
            ok: true,
            submittedIds: [],
            removedIds: [],
            totalProcessed: 0,
            successCount: 0,
            removedCount: 0
        };
    }
    
    // Mark entries as in-progress to protect them from orphan cleanup during submission
    const entryIds = dbRows.map(r => r.id);
    markTimesheetEntriesAsInProgress(entryIds);
    botLogger.info('Entries marked as in-progress', { count: entryIds.length });
    
    // Convert database rows to TimesheetEntry format
    const entries = dbRows.map(toTimesheetEntry);
    botLogger.verbose('Converted entries for submission', { count: entries.length });
    botLogger.debug('Entry dates for submission', { 
        entries: entries.map(e => ({ id: e.id, date: e.date }))
    });
    
    // Get the active submission service from the plugin system
    const submissionService = getSubmissionService() as ISubmissionService | null;
    botLogger.verbose('Retrieved submission service', {
        hasService: !!submissionService,
        serviceName: submissionService?.metadata?.name,
        hasSubmit: !!submissionService?.submit
    });
    
    if (!submissionService || !submissionService.submit) {
        const errorMsg = 'Submission service not available';
        botLogger.error('Could not get submission service from plugin system', {
            hasService: !!submissionService,
            serviceName: submissionService?.metadata?.name
        });
        timer.done({ outcome: 'error', reason: 'service-unavailable' });
        return {
            ok: false,
            submittedIds: [],
            removedIds: [],
            totalProcessed: dbRows.length,
            successCount: 0,
            removedCount: 0,
            error: errorMsg
        };
    }
    
    // Use the plugin system to submit entries
    botLogger.info('Using submission service from plugin system', { 
        serviceName: submissionService.metadata?.name || 'unknown'
    });
    
    try {
        // Check if already aborted before starting
        if (abortSignal?.aborted) {
            botLogger.info('Submission aborted before starting');
            timer.done({ outcome: 'aborted' });
            return {
                ok: false,
                submittedIds: [],
                removedIds: [],
                totalProcessed: dbRows.length,
                successCount: 0,
                removedCount: 0,
                error: 'Submission was cancelled'
            };
        }
        
        const credentials: Credentials = { email, password };
        const result = await submissionService.submit(entries, credentials, progressCallback, abortSignal);
        
        botLogger.info('Submission completed via plugin system', { 
            ok: result.ok,
            successCount: result.successCount,
            removedCount: result.removedCount,
            submittedIds: result.submittedIds,
            removedIds: result.removedIds
        });
        
        // Update database based on results
        if (result.submittedIds && result.submittedIds.length > 0) {
            botLogger.info('Marking entries as submitted in database', { 
                count: result.submittedIds.length,
                ids: result.submittedIds
            });
            try {
                markTimesheetEntriesAsSubmitted(result.submittedIds);
                botLogger.info('Successfully marked entries as submitted', { 
                    count: result.submittedIds.length 
                });
            } catch (markError) {
                botLogger.error('Could not mark entries as submitted in database', { 
                    error: markError instanceof Error ? markError.message : String(markError),
                    count: result.submittedIds.length,
                    ids: result.submittedIds
                });
                // Even though bot submission succeeded, database update failed
                // Reset these entries back to pending so user can retry
                try {
                    const { resetTimesheetEntriesStatus } = require('./database');
                    resetTimesheetEntriesStatus(result.submittedIds);
                    botLogger.info('Reset entries to pending after database update failure', { 
                        count: result.submittedIds.length 
                    });
                } catch (resetError) {
                    botLogger.error('Could not reset entries after database update failure', { 
                        error: resetError instanceof Error ? resetError.message : String(resetError)
                    });
                }
                // Return error result since database update failed
                timer.done({ outcome: 'error', reason: 'database-update-failed' });
                return {
                    ok: false,
                    submittedIds: [],
                    removedIds: result.submittedIds, // Treat as failed since database update failed
                    totalProcessed: dbRows.length,
                    successCount: 0,
                    removedCount: result.submittedIds.length,
                    error: 'Submission to Smartsheet succeeded but database update failed. Entries have been reset to pending.'
                };
            }
        }
        
        if (result.removedIds && result.removedIds.length > 0) {
            botLogger.warn('Removing failed entries from database', { 
                count: result.removedIds.length
            });
            try {
                removeFailedTimesheetEntries(result.removedIds);
            } catch (removeError) {
                botLogger.error('Could not remove failed entries from database', { 
                    error: removeError instanceof Error ? removeError.message : String(removeError),
                    count: result.removedIds.length
                });
                // Don't fail the entire operation if we can't update failed entries
            }
        }
        
        timer.done({ outcome: result.ok ? 'success' : 'partial', result });
        return result;
    } catch (error) {
        // Check if error is due to abort or browser closure
        if (error instanceof Error) {
            const errorMsg = error.message.toLowerCase();
            if (error.name === 'AbortError' || errorMsg.includes('cancelled') || errorMsg.includes('aborted') || errorMsg.includes('browser has been closed')) {
                botLogger.info('Submission was cancelled by user');
                timer.done({ outcome: 'cancelled' });
                return {
                    ok: false,
                    submittedIds: [],
                    removedIds: [],
                    totalProcessed: dbRows.length,
                    successCount: 0,
                    removedCount: 0,
                    error: 'Submission was cancelled'
                };
            }
        }
        
        botLogger.error('Submission service encountered error', { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        
        timer.done({ outcome: 'error', reason: 'service-error' });
        return {
            ok: false,
            submittedIds: [],
            removedIds: [],
            totalProcessed: dbRows.length,
            successCount: 0,
            removedCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Gets pending timesheet entries for review
 * 
 * @returns Array of pending timesheet entries
 */
export function getPendingEntries(): DbRow[] {
    return getPendingTimesheetEntries() as DbRow[];
}

/**
 * Gets timesheet entries by their IDs
 * 
 * @param ids - Array of entry IDs
 * @returns Array of timesheet entries
 */
export function getEntriesByIds(ids: number[]): DbRow[] {
    return getTimesheetEntriesByIds(ids) as DbRow[];
}