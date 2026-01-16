export interface SubmitResult {
  ok: boolean;
  successCount: number;
  removedCount: number;
  totalProcessed: number;
  error?: string;
}

export interface SubmitResponse {
  error?: string;
  submitResult?: SubmitResult;
  dbPath?: string;
}

import { submitTimesheet as submitTimesheetIpc } from '@/services/ipc/timesheet';
import { logError, logInfo, logWarn } from '@/services/ipc/logger';

function hasSubmissionFailure(res: SubmitResponse): boolean {
  if (res.error) {
    logError('Timesheet submission failed', { error: res.error });
    return true;
  }

  if (res.submitResult && !res.submitResult.ok) {
    logError('Timesheet submission failed', { submitResult: res.submitResult });
    return true;
  }

  return false;
}

function buildSubmitMessage(submitResult?: SubmitResult): string {
  if (!submitResult) {
    return '✅ No pending entries to submit';
  }

  return `✅ Submitted ${submitResult.successCount}/${submitResult.totalProcessed} entries to SmartSheet`;
}

async function refreshAfterSubmit(
  submitResult: SubmitResult | undefined,
  onRefresh?: () => Promise<void>
): Promise<void> {
  if (!submitResult || submitResult.successCount <= 0 || !onRefresh) {
    return;
  }

  logInfo('Triggering data refresh after successful submission');
  try {
    await onRefresh();
    logInfo('Data refresh completed successfully');
  } catch (refreshError) {
    logWarn('Could not refresh data after submission', {
      error: refreshError instanceof Error ? refreshError.message : String(refreshError),
    });
    // Don't fail the submission if refresh fails - just log it
  }
}

async function submitTimesheet(
  token: string,
  onRefresh?: () => Promise<void>,
  useMockWebsite?: boolean
): Promise<SubmitResponse> {
  logInfo('Starting timesheet submission', { useMockWebsite: useMockWebsite || false });
  const res = await submitTimesheetIpc(token, useMockWebsite);

  if (hasSubmissionFailure(res)) {
    return res;
  }

  logInfo(buildSubmitMessage(res.submitResult));
  await refreshAfterSubmit(res.submitResult, onRefresh);

  return res;
}

export { submitTimesheet };
