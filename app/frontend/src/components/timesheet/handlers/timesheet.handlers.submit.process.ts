/**
 * Helper functions for processing submission
 */

export async function processSubmission(
  token: string,
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
  handleRefreshAfterSubmission: () => Promise<Error | null>
): Promise<{
  res: {
    error?: string;
    submitResult?: {
      ok: boolean;
      successCount: number;
      totalProcessed: number;
      removedCount: number;
      error?: string;
    };
  };
  refreshError: Error | null;
}> {
  const res = await submitTimesheetFn(token, async () => {
    const refreshError = await handleRefreshAfterSubmission();
    return refreshError;
  });
  const refreshError = await handleRefreshAfterSubmission();
  return { res, refreshError };
}

export function handleSubmissionException(
  error: unknown
): {
  submissionError: Error;
  errorMsg: string;
} {
  const submissionError =
    error instanceof Error ? error : new Error(String(error));
  const errorMsg = `❌ Unexpected error during submission: ${submissionError.message}`;
  window.logger?.error("Unexpected error during submission", {
    error: submissionError.message,
    stack: submissionError.stack,
  });
  window.alert(errorMsg);
  return { submissionError, errorMsg };
}
