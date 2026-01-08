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
    getTimesheetEntriesByIds,
    resetInProgressTimesheetEntries
} from '../repositories';
import { botLogger } from '@sheetpilot/shared/logger';
import { getSubmissionService } from '../middleware/bootstrap-plugins';
import type { TimesheetEntry } from '../../../shared/contracts/IDataService';
import type { Credentials } from '../../../shared/contracts/ICredentialService';
import type { SubmissionResult, ISubmissionService } from '../../../shared/contracts/ISubmissionService';
import {
  formatMinutesToTime,
  normalizeDateToISO
} from '../../../shared/utils/format-conversions';
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
    // Convert date from MM/DD/YYYY to YYYY-MM-DD format for quarter matching
    const dateStr = normalizeDateToISO(dbRow.date);
    
    return {
        id: dbRow.id,
        date: dateStr,
        timeIn: formatMinutesToTime(dbRow.time_in),
        timeOut: formatMinutesToTime(dbRow.time_out),
        project: dbRow.project,
        tool: dbRow.tool ?? null,
        chargeCode: dbRow.detail_charge_code ?? null,
        taskDescription: dbRow.task_description
    };
}

/**
 * Creates an empty submission result
 */
function createEmptyResult(totalProcessed: number, error?: string): SubmissionResult {
    return {
        ok: !error,
        submittedIds: [],
        removedIds: [],
        totalProcessed,
        successCount: 0,
        removedCount: 0,
        ...(error && { error })
    };
}

/**
 * Prepares entries for submission by fetching from database and marking as in-progress
 */
function prepareEntriesForSubmission(): { entries: TimesheetEntry[]; dbRows: DbRow[] } | null {
    ensureSchema();
    
    const dbRows = getPendingTimesheetEntries() as DbRow[];
    botLogger.verbose('Pending timesheet entries retrieved', { count: dbRows.length });
    botLogger.debug('Pending entry details', { 
        entries: dbRows.map(r => ({ id: r.id, date: r.date, status: r.status }))
    });
    
    if (dbRows.length === 0) {
        botLogger.info('No pending timesheet entries to submit');
        return null;
    }
    
    const entryIds = dbRows.map(r => r.id);
    markTimesheetEntriesAsInProgress(entryIds);
    botLogger.info('Entries marked as in-progress', { count: entryIds.length });
    
    const entries = dbRows.map(toTimesheetEntry);
    botLogger.verbose('Converted entries for submission', { count: entries.length });
    botLogger.debug('Entry dates for submission', { 
        entries: entries.map(e => ({ id: e.id, date: e.date }))
    });
    
    return { entries, dbRows };
}

/**
 * Validates and retrieves the submission service
 */
function validateSubmissionService(): ISubmissionService | null {
    const submissionService = getSubmissionService() as ISubmissionService | null;
    botLogger.verbose('Retrieved submission service', {
        hasService: !!submissionService,
        serviceName: submissionService?.metadata?.name,
        hasSubmit: !!submissionService?.submit
    });
    
    if (!submissionService || !submissionService.submit) {
        botLogger.error('Could not get submission service from plugin system', {
            hasService: !!submissionService,
            serviceName: submissionService?.metadata?.name
        });
        return null;
    }
    
    botLogger.info('Using submission service from plugin system', { 
        serviceName: submissionService.metadata?.name || 'unknown'
    });
    
    return submissionService;
}

/**
 * Resets in-progress entries and logs the action
 */
function resetInProgressEntries(context: string): void {
    const remainingInProgressCount = resetInProgressTimesheetEntries();
    if (remainingInProgressCount > 0) {
        botLogger.info(`Reset remaining in-progress entries to NULL after ${context}`, { 
            count: remainingInProgressCount 
        });
    }
}

/**
 * Checks if an error indicates cancellation
 */
function isCancellationError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const errorMsg = error.message.toLowerCase();
    return error.name === 'AbortError' || 
           errorMsg.includes('cancelled') || 
           errorMsg.includes('aborted') || 
           errorMsg.includes('browser has been closed');
}

/**
 * Handles marking submitted entries in the database
 */
function handleMarkSubmittedEntries(submittedIds: number[], dbRowsLength: number): SubmissionResult | null {
    botLogger.info('Marking entries as submitted in database', { 
        count: submittedIds.length,
        ids: submittedIds
    });
    
    try {
        markTimesheetEntriesAsSubmitted(submittedIds);
        botLogger.info('Successfully marked entries as submitted', { 
            count: submittedIds.length 
        });
        return null; // Success, no error
    } catch (markError) {
        botLogger.error('Could not mark entries as submitted in database', { 
            error: markError instanceof Error ? markError.message : String(markError),
            count: submittedIds.length,
            ids: submittedIds
        });
        
        // Reset entries back to pending so user can retry
        try {
            const { resetTimesheetEntriesStatus } = require('./database');
            resetTimesheetEntriesStatus(submittedIds);
            botLogger.info('Reset entries to pending after database update failure', { 
                count: submittedIds.length 
            });
        } catch (resetError) {
            botLogger.error('Could not reset entries after database update failure', { 
                error: resetError instanceof Error ? resetError.message : String(resetError)
            });
        }
        
        return {
            ok: false,
            submittedIds: [],
            removedIds: submittedIds,
            totalProcessed: dbRowsLength,
            successCount: 0,
            removedCount: submittedIds.length,
            error: 'Submission to Smartsheet succeeded but database update failed. Entries have been reset to pending.'
        };
    }
}

/**
 * Processes the submission result and updates the database
 */
function processSubmissionResult(result: SubmissionResult, dbRowsLength: number): SubmissionResult {
    if (result.submittedIds && result.submittedIds.length > 0) {
        const dbError = handleMarkSubmittedEntries(result.submittedIds, dbRowsLength);
        if (dbError) return dbError;
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
        }
    }
    
    resetInProgressEntries('bot completion');
    return result;
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
export async function submitTimesheets(email: string, password: string, progressCallback?: (percent: number, message: string) => void, abortSignal?: AbortSignal, useMockWebsite?: boolean): Promise<SubmissionResult> {
    const timer = botLogger.startTimer('submit-timesheets');
    botLogger.info('Starting automated timesheet submission', { email });
    
    // Prepare entries for submission
    const prepared = prepareEntriesForSubmission();
    if (!prepared) {
        timer.done({ totalProcessed: 0, successCount: 0 });
        return createEmptyResult(0);
    }
    
    const { entries, dbRows } = prepared;
    
    // Validate submission service
    const submissionService = validateSubmissionService();
    if (!submissionService) {
        resetInProgressEntries('service unavailable');
        timer.done({ outcome: 'error', reason: 'service-unavailable' });
        return createEmptyResult(dbRows.length, 'Submission service not available');
    }
    
    try {
        // Check if already aborted before starting
        if (abortSignal?.aborted) {
            botLogger.info('Submission aborted before starting');
            resetInProgressEntries('abort before start');
            timer.done({ outcome: 'aborted' });
            return createEmptyResult(dbRows.length, 'Submission was cancelled');
        }
        
        // Submit entries via plugin system
        const credentials: Credentials = { email, password };
        const result = await submissionService.submit(entries, credentials, progressCallback, abortSignal, useMockWebsite);
        
        botLogger.info('Submission completed via plugin system', { 
            ok: result.ok,
            successCount: result.successCount,
            removedCount: result.removedCount,
            submittedIds: result.submittedIds,
            removedIds: result.removedIds
        });
        
        // Process results and update database
        const processedResult = processSubmissionResult(result, dbRows.length);
        if (!processedResult.ok && processedResult.error?.includes('database update failed')) {
            timer.done({ outcome: 'error', reason: 'database-update-failed' });
        } else {
            timer.done({ outcome: processedResult.ok ? 'success' : 'partial', processedResult });
        }
        return processedResult;
    } catch (error) {
        if (isCancellationError(error)) {
            botLogger.info('Submission was cancelled by user');
            resetInProgressEntries('cancellation');
            timer.done({ outcome: 'cancelled' });
            return createEmptyResult(dbRows.length, 'Submission was cancelled');
        }
        
        botLogger.error('Submission service encountered error', { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        
        resetInProgressEntries('error');
        timer.done({ outcome: 'error', reason: 'service-error' });
        return createEmptyResult(dbRows.length, error instanceof Error ? error.message : 'Unknown error');
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