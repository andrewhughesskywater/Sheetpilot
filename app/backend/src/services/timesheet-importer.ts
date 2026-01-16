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
  resetInProgressTimesheetEntries,
  resetTimesheetEntriesStatus,
} from "@/models";
import { botLogger } from "@sheetpilot/shared/logger";
import { getSubmissionService } from "@/middleware/bootstrap-plugins";
import type {
  TimesheetEntry,
  Credentials,
  SubmissionResult,
  ISubmissionService,
} from "@sheetpilot/shared";
import { normalizeDateToISO } from "@sheetpilot/shared";
// Dynamic import to avoid top-level async operations during module loading

/**
 * Database row type for timesheet entries
 */
type DbRow = {
  id: number;
  date: string;
  hours: number | null;
  project: string;
  tool?: string | null;
  detail_charge_code?: string | null;
  task_description: string;
  status?: string | null;
  submitted_at?: string | null;
};

type SubmissionTimer = ReturnType<typeof botLogger.startTimer>;

/**
 * Result object for timesheet submission operations
 * Re-export the contract type for backward compatibility
 */
export type { SubmissionResult } from "@sheetpilot/shared";

/**
 * Converts database row format to TimesheetEntry format
 */
function toTimesheetEntry(dbRow: DbRow): TimesheetEntry {
  // Convert date from MM/DD/YYYY to YYYY-MM-DD format for quarter matching
  const dateStr = normalizeDateToISO(dbRow.date);

  return {
    id: dbRow.id,
    date: dateStr,
    hours: dbRow.hours ?? 0,
    project: dbRow.project,
    tool: dbRow.tool ?? null,
    chargeCode: dbRow.detail_charge_code ?? null,
    taskDescription: dbRow.task_description,
  };
}

const buildEmptySubmissionResult = (): SubmissionResult => ({
  ok: true,
  submittedIds: [],
  removedIds: [],
  totalProcessed: 0,
  successCount: 0,
  removedCount: 0,
});

const buildFailureResult = (
  dbRowCount: number,
  error: string,
  removedIds: number[] = []
): SubmissionResult => ({
  ok: false,
  submittedIds: [],
  removedIds,
  totalProcessed: dbRowCount,
  successCount: 0,
  removedCount: removedIds.length,
  error,
});

const resetInProgressWithLog = (message: string): void => {
  const remainingInProgressCount = resetInProgressTimesheetEntries();
  if (remainingInProgressCount > 0) {
    botLogger.info(message, {
      count: remainingInProgressCount,
    });
  }
};

const handleServiceUnavailable = (
  submissionService: ISubmissionService | null,
  dbRowCount: number,
  timer: SubmissionTimer
): SubmissionResult => {
  const errorMsg = "Submission service not available";
  botLogger.error("Could not get submission service from plugin system", {
    hasService: !!submissionService,
    serviceName: submissionService?.metadata?.name,
  });
  resetInProgressWithLog(
    "Reset in-progress entries to NULL after service unavailable"
  );
  timer.done({ outcome: "error", reason: "service-unavailable" });
  return buildFailureResult(dbRowCount, errorMsg);
};

const handleAbortBeforeStart = (
  dbRowCount: number,
  timer: SubmissionTimer
): SubmissionResult => {
  botLogger.info("Submission aborted before starting");
  resetInProgressWithLog(
    "Reset in-progress entries to NULL after abort before start"
  );
  timer.done({ outcome: "aborted" });
  return buildFailureResult(dbRowCount, "Submission was cancelled");
};

const handleSubmittedEntriesUpdate = (
  submittedIds: number[],
  dbRowCount: number,
  timer: SubmissionTimer
): SubmissionResult | null => {
  if (submittedIds.length === 0) {
    return null;
  }

  botLogger.info("Marking entries as submitted in database", {
    count: submittedIds.length,
    ids: submittedIds,
  });
  try {
    markTimesheetEntriesAsSubmitted(submittedIds);
    botLogger.info("Successfully marked entries as submitted", {
      count: submittedIds.length,
    });
    return null;
  } catch (markError) {
    botLogger.error("Could not mark entries as submitted in database", {
      error: markError instanceof Error ? markError.message : String(markError),
      count: submittedIds.length,
      ids: submittedIds,
    });
    // Even though bot submission succeeded, database update failed
    // Reset these entries back to pending so user can retry
    try {
      resetTimesheetEntriesStatus(submittedIds);
      botLogger.info(
        "Reset entries to pending after database update failure",
        {
          count: submittedIds.length,
        }
      );
    } catch (resetError) {
      botLogger.error(
        "Could not reset entries after database update failure",
        {
          error:
            resetError instanceof Error
              ? resetError.message
              : String(resetError),
        }
      );
    }
    timer.done({ outcome: "error", reason: "database-update-failed" });
    return buildFailureResult(
      dbRowCount,
      "Submission to Smartsheet succeeded but database update failed. Entries have been reset to pending.",
      submittedIds
    );
  }
};

const removeFailedEntries = (removedIds: number[]): void => {
  if (removedIds.length === 0) {
    return;
  }
  botLogger.warn("Removing failed entries from database", {
    count: removedIds.length,
  });
  try {
    removeFailedTimesheetEntries(removedIds);
  } catch (removeError) {
    botLogger.error("Could not remove failed entries from database", {
      error:
        removeError instanceof Error ? removeError.message : String(removeError),
      count: removedIds.length,
    });
    // Don't fail the entire operation if we can't update failed entries
  }
};

const finalizeSubmission = (
  result: SubmissionResult,
  timer: SubmissionTimer
): SubmissionResult => {
  resetInProgressWithLog(
    "Reset remaining in-progress entries to NULL after bot completion"
  );
  timer.done({ outcome: result.ok ? "success" : "partial", result });
  return result;
};

const isAbortError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const errorMsg = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
    errorMsg.includes("cancelled") ||
    errorMsg.includes("aborted") ||
    errorMsg.includes("browser has been closed")
  );
};

const handleSubmissionCancelled = (
  dbRowCount: number,
  timer: SubmissionTimer
): SubmissionResult => {
  botLogger.info("Submission was cancelled by user");
  resetInProgressWithLog(
    "Reset remaining in-progress entries to NULL after cancellation"
  );
  timer.done({ outcome: "cancelled" });
  return buildFailureResult(dbRowCount, "Submission was cancelled");
};

const handleSubmissionError = (
  error: unknown,
  dbRowCount: number,
  timer: SubmissionTimer
): SubmissionResult => {
  botLogger.error("Submission service encountered error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  resetInProgressWithLog(
    "Reset remaining in-progress entries to NULL after error"
  );

  timer.done({ outcome: "error", reason: "service-error" });
  return buildFailureResult(
    dbRowCount,
    error instanceof Error ? error.message : "Unknown error"
  );
};

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
export async function submitTimesheets(
  email: string,
  password: string,
  progressCallback?: (percent: number, message: string) => void,
  abortSignal?: AbortSignal,
  useMockWebsite?: boolean
): Promise<SubmissionResult> {
  const timer = botLogger.startTimer("submit-timesheets");
  botLogger.info("Starting automated timesheet submission", { email });

  // Ensure database schema is up to date
  ensureSchema();

  // Fetch pending rows from database
  const dbRows = getPendingTimesheetEntries() as DbRow[];
  botLogger.verbose("Pending timesheet entries retrieved", {
    count: dbRows.length,
  });
  botLogger.debug("Pending entry details", {
    entries: dbRows.map((r) => ({ id: r.id, date: r.date, status: r.status })),
  });

  if (dbRows.length === 0) {
    botLogger.info("No pending timesheet entries to submit");
    timer.done({ totalProcessed: 0, successCount: 0 });
    return buildEmptySubmissionResult();
  }

  // Mark entries as in-progress to protect them from orphan cleanup during submission
  const entryIds = dbRows.map((r) => r.id);
  markTimesheetEntriesAsInProgress(entryIds);
  botLogger.info("Entries marked as in-progress", { count: entryIds.length });

  // Convert database rows to TimesheetEntry format
  const entries = dbRows.map(toTimesheetEntry);
  botLogger.verbose("Converted entries for submission", {
    count: entries.length,
  });
  botLogger.debug("Entry dates for submission", {
    entries: entries.map((e) => ({ id: e.id, date: e.date })),
  });

  // Get the active submission service from the plugin system
  const submissionService = getSubmissionService() as ISubmissionService | null;
  botLogger.verbose("Retrieved submission service", {
    hasService: !!submissionService,
    serviceName: submissionService?.metadata?.name,
    hasSubmit: !!submissionService?.submit,
  });

  if (!submissionService || !submissionService.submit) {
    return handleServiceUnavailable(submissionService, dbRows.length, timer);
  }

  // Use the plugin system to submit entries
  botLogger.info("Using submission service from plugin system", {
    serviceName: submissionService.metadata?.name || "unknown",
  });

  try {
    // Check if already aborted before starting
    if (abortSignal?.aborted) {
      return handleAbortBeforeStart(dbRows.length, timer);
    }

    const credentials: Credentials = { email, password };
    const result = await submissionService.submit(
      entries,
      credentials,
      progressCallback,
      abortSignal,
      useMockWebsite
    );

    botLogger.info("Submission completed via plugin system", {
      ok: result.ok,
      successCount: result.successCount,
      removedCount: result.removedCount,
      submittedIds: result.submittedIds,
      removedIds: result.removedIds,
    });

    // Update database based on results
    const submittedIds = result.submittedIds ?? [];
    const updateFailureResult = handleSubmittedEntriesUpdate(
      submittedIds,
      dbRows.length,
      timer
    );
    if (updateFailureResult) {
      return updateFailureResult;
    }

    removeFailedEntries(result.removedIds ?? []);

    return finalizeSubmission(result, timer);
  } catch (error) {
    if (isAbortError(error)) {
      return handleSubmissionCancelled(dbRows.length, timer);
    }

    return handleSubmissionError(error, dbRows.length, timer);
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
