/**
 * Helper functions for submit handler
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";

export function validateSubmissionPreconditions(
  isProcessingRef: { current: boolean },
  isAdmin: boolean,
  token: string | null,
  timesheetDraftData: TimesheetRow[]
): { isValid: boolean; errorMsg: string | null } {
  if (isProcessingRef.current) {
    window.logger?.warn("Submit ignored - already processing (ref)");
    return { isValid: false, errorMsg: null };
  }

  if (isAdmin) {
    const errorMsg =
      "❌ Admin users cannot submit timesheet entries to SmartSheet.";
    window.alert(errorMsg);
    window.logger?.warn("Admin attempted timesheet submission");
    return { isValid: false, errorMsg };
  }

  if (!token) {
    const errorMsg = "❌ Session token is required. Please log in again.";
    window.alert(errorMsg);
    window.logger?.warn("Submit attempted without session token");
    return { isValid: false, errorMsg };
  }

  if (!timesheetDraftData || timesheetDraftData.length === 0) {
    const errorMsg = "❌ No timesheet data to submit.";
    window.alert(errorMsg);
    window.logger?.warn("Submit attempted with no data");
    return { isValid: false, errorMsg };
  }

  return { isValid: true, errorMsg: null };
}

export async function handleRefreshAfterSubmission(
  refreshTimesheetDraft: () => Promise<void>,
  refreshArchiveData: () => Promise<void>
): Promise<Error | null> {
  let refreshError: Error | null = null;
  try {
    await refreshTimesheetDraft();
  } catch (err) {
    refreshError = err instanceof Error ? err : new Error(String(err));
    window.logger?.error(
      "Could not refresh timesheet data after submission",
      {
        error: refreshError.message,
      }
    );
  }
  try {
    await refreshArchiveData();
  } catch (err) {
    refreshError = err instanceof Error ? err : new Error(String(err));
    window.logger?.error("Could not refresh archive data after submission", {
      error: refreshError.message,
    });
  }
  return refreshError;
}

function handleSubmissionError(error: string): {
  submissionError: Error;
  shouldReturn: boolean;
} {
  const submissionError = new Error(error);
  const errorMsg = `❌ Submission failed: ${error}`;
  window.alert(errorMsg);
  window.logger?.error("Timesheet submission failed", {
    error,
  });
  return { submissionError, shouldReturn: true };
}

function handlePartialFailure(
  submitResult: {
    successCount: number;
    totalProcessed: number;
    removedCount: number;
    error?: string;
  }
): {
  submissionError: Error;
  shouldReturn: boolean;
} {
  const errorDetails = submitResult.error || "Unknown error";
  const submissionError = new Error(errorDetails);
  const errorMsg = `❌ Submission failed: ${submitResult.successCount}/${submitResult.totalProcessed} entries processed, ${submitResult.removedCount} failed. Error: ${errorDetails}`;
  window.alert(errorMsg);
  window.logger?.error("Timesheet submission partially failed", {
    successCount: submitResult.successCount,
    totalProcessed: submitResult.totalProcessed,
    removedCount: submitResult.removedCount,
    error: errorDetails,
  });
  return { submissionError, shouldReturn: true };
}

function handleSubmissionSuccess(
  submitResult?: {
    successCount: number;
    totalProcessed: number;
  }
): void {
  const submitMsg = submitResult
    ? `✅ Submitted ${submitResult.successCount}/${submitResult.totalProcessed} entries to SmartSheet`
    : "✅ No pending entries to submit";
  window.alert(submitMsg);
  window.logger?.info("Timesheet submission completed successfully", {
    successCount: submitResult?.successCount,
    totalProcessed: submitResult?.totalProcessed,
  });
}

export function handleSubmissionResult(
  res: {
    error?: string;
    submitResult?: {
      ok: boolean;
      successCount: number;
      totalProcessed: number;
      removedCount: number;
      error?: string;
    };
  }
): { submissionError: Error | null; shouldReturn: boolean } {
  if (res.error) {
    return handleSubmissionError(res.error);
  }

  if (res.submitResult && !res.submitResult.ok) {
    return handlePartialFailure(res.submitResult);
  }

  handleSubmissionSuccess(res.submitResult);
  return { submissionError: null, shouldReturn: false };
}

export async function handleFinallyBlockRefresh(
  submissionError: Error | null,
  refreshTimesheetDraft: () => Promise<void>,
  refreshArchiveData: () => Promise<void>,
  logVerboseFn: (message: string, meta?: Record<string, unknown>) => void,
  logErrorFn: (message: string, meta?: Record<string, unknown>) => void
): Promise<void> {
  if (!submissionError) {
    logVerboseFn("Refreshing data in finally block");
    try {
      await Promise.all([
        refreshTimesheetDraft().catch((err) => {
          logErrorFn("Could not refresh timesheet data in finally block", {
            error: err instanceof Error ? err.message : String(err),
          });
        }),
        refreshArchiveData().catch((err) => {
          logErrorFn("Could not refresh archive data in finally block", {
            error: err instanceof Error ? err.message : String(err),
          });
        }),
      ]);
    } catch (err) {
      logErrorFn("Error during data refresh in finally block", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
