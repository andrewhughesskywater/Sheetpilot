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

import { submitTimesheet as submitTimesheetIpc } from '../../services/ipc/timesheet';
import { logError, logInfo, logWarn } from '../../services/ipc/logger';

async function submitTimesheet(
  token: string,
  onRefresh?: () => Promise<void>,
  useMockWebsite?: boolean
): Promise<SubmitResponse> {
  logInfo('Starting timesheet submission', { useMockWebsite: useMockWebsite || false });
  const res = await submitTimesheetIpc(token, useMockWebsite);
  
  if (res.error) {
    logError('Timesheet submission failed', { error: res.error });
    return res;
  }
  
  // Check if submission was successful
  if (res.submitResult && !res.submitResult.ok) {
    logError('Timesheet submission failed', { submitResult: res.submitResult });
    return res;
  }
  
  const submitMsg = res.submitResult ? 
    `✅ Submitted ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries to SmartSheet` : 
    '✅ No pending entries to submit';
  logInfo(submitMsg);
  
  // Refresh data if entries were submitted
  if (res.submitResult && res.submitResult.successCount > 0 && onRefresh) {
    logInfo('Triggering data refresh after successful submission');
    try {
      await onRefresh();
      logInfo('Data refresh completed successfully');
    } catch (refreshError) {
      logWarn('Could not refresh data after submission', { 
        error: refreshError instanceof Error ? refreshError.message : String(refreshError) 
      });
      // Don't fail the submission if refresh fails - just log it
    }
  }
  
  return res;
}

export { submitTimesheet };
