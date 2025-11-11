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
}

export async function submitTimesheet(
  token: string,
  onRefresh?: () => Promise<void>
): Promise<SubmitResponse> {
  if (!window.timesheet?.submit) {
    window.logger?.warn('Submit not available');
    return { error: 'Timesheet API not available' };
  }
  
  window.logger?.info('Starting timesheet submission');
  const res = await window.timesheet.submit(token);
  
  if (res.error) {
    window.logger?.error('Timesheet submission failed', { error: res.error });
    return res;
  }
  
  // Check if submission was successful
  if (res.submitResult && !res.submitResult.ok) {
    window.logger?.error('Timesheet submission failed', { submitResult: res.submitResult });
    return res;
  }
  
  const submitMsg = res.submitResult ? 
    `✅ Submitted ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries to SmartSheet` : 
    '✅ No pending entries to submit';
  window.logger?.info(submitMsg);
  
  // Refresh data if entries were submitted
  if (res.submitResult && res.submitResult.successCount > 0 && onRefresh) {
    window.logger?.info('Triggering data refresh after successful submission');
    try {
      await onRefresh();
      window.logger?.info('Data refresh completed successfully');
    } catch (refreshError) {
      window.logger?.error('Could not refresh data after submission', { 
        error: refreshError instanceof Error ? refreshError.message : String(refreshError) 
      });
      // Don't fail the submission if refresh fails - just log it
    }
  }
  
  return res;
}

