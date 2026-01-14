/**
 * Handler for submit timesheet function
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { MutableRefObject } from "react";
import {
  validateSubmissionPreconditions,
  handleRefreshAfterSubmission,
  handleSubmissionResult,
  handleFinallyBlockRefresh,
} from "./timesheet.handlers.submit.helpers";
import { handleSubmissionException } from "./timesheet.handlers.submit.process";

/**
 * Create handle submit timesheet function
 */
export function createHandleSubmitTimesheet(
  isProcessingRef: MutableRefObject<boolean>,
  setIsProcessing: (value: boolean) => void,
  isAdmin: boolean,
  token: string | null,
  timesheetDraftData: TimesheetRow[],
  refreshTimesheetDraft: () => Promise<void>,
  refreshArchiveData: () => Promise<void>,
  submitTimesheetFn: (
    token: string,
    onSuccess?: () => Promise<void>
  ) => Promise<{
    error?: string;
    submitResult?: {
      ok: boolean;
      successCount: number;
      totalProcessed: number;
      removedCount: number;
      error?: string;
    };
  }>,
  logErrorFn: (message: string, meta?: Record<string, unknown>) => void,
  logWarnFn: (message: string, meta?: Record<string, unknown>) => void,
  logVerboseFn: (message: string, meta?: Record<string, unknown>) => void
): () => Promise<void> {
  return async () => {
    window.logger?.info("Submit button clicked");

    const { isValid } = validateSubmissionPreconditions(
      isProcessingRef,
      isAdmin,
      token,
      timesheetDraftData
    );
    if (!isValid) {
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);

    let submissionError: Error | null = null;
    let refreshError: Error | null = null;

    try {
      const res = await submitTimesheetFn(token, async () => {
        refreshError = await handleRefreshAfterSubmission(
          refreshTimesheetDraft,
          refreshArchiveData
        );
      });

      const result = handleSubmissionResult(res);
      submissionError = result.submissionError;
      if (result.shouldReturn) {
        return;
      }
    } catch (error) {
      const exceptionResult = handleSubmissionException(error);
      submissionError = exceptionResult.submissionError;
    } finally {
      /**
       * WHY: Must reset state in finally block to prevent UI lockup if browser closed
       * during submission or if errors occur. Without this, submit button stays disabled.
       */
      window.logger?.verbose("Resetting submission state in finally block");
      isProcessingRef.current = false;
      setIsProcessing(false);

      /**
       * WHY: Refresh data even on error to handle partial successes where some entries
       * submitted but others failed. Ensures UI reflects actual database state.
       */
      await handleFinallyBlockRefresh(
        submissionError,
        refreshTimesheetDraft,
        refreshArchiveData,
        logVerboseFn,
        logErrorFn
      );

      if (refreshError !== null && !submissionError) {
        const err: Error = refreshError as Error;
        const errorMessage = err.message || String(refreshError);
        logWarnFn("Submission succeeded but data refresh failed", {
          error: errorMessage,
        });
      }
    }
  };
}
