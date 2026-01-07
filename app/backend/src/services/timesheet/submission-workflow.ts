import { ipcLogger } from '@sheetpilot/shared/logger';
import {
  getDbPath,
  getPendingTimesheetEntries,
  getCredentials,
  resetInProgressTimesheetEntries,
  resetTimesheetEntriesStatus,
  validateSession
} from '../../repositories';
import { submitTimesheets } from '../timesheet-importer';
import { createUserFriendlyMessage, extractErrorCode } from '@sheetpilot/shared/errors';

export interface SubmitWorkflowResult {
  submitResult?: { ok: boolean; successCount: number; removedCount: number; totalProcessed: number };
  dbPath?: string;
  error?: string;
}

let isSubmissionInProgress = false;
let currentSubmissionAbortController: AbortController | null = null;

export function isTimesheetSubmissionInProgress(): boolean {
  return isSubmissionInProgress;
}

export function cancelTimesheetSubmission(): { success: boolean; message?: string; error?: string } {
  ipcLogger.info('Timesheet cancellation requested');

  if (!isSubmissionInProgress) {
    ipcLogger.warn('No submission in progress to cancel');
    return { success: false, error: 'No submission in progress' };
  }

  if (!currentSubmissionAbortController) {
    ipcLogger.warn('No abort controller available');
    return { success: false, error: 'Cannot cancel submission' };
  }

  try {
    currentSubmissionAbortController.abort();
    ipcLogger.info('Submission cancelled successfully');

    const resetCount = resetInProgressTimesheetEntries();
    ipcLogger.info('Reset in-progress entries to pending', { count: resetCount });

    return { success: true, message: 'Submission cancelled' };
  } catch (err: unknown) {
    ipcLogger.error('Could not cancel submission', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function submitTimesheetWorkflow(params: {
  token: string;
  useMockWebsite?: boolean;
  onProgress: (percent: number, message: string, meta: { pendingIds: number[] }) => void;
}): Promise<SubmitWorkflowResult> {
  ipcLogger.verbose('Timesheet submit workflow called');
  const timer = ipcLogger.startTimer('timesheet-submit');

  if (isSubmissionInProgress) {
    ipcLogger.warn('Submission already in progress, rejecting concurrent request');
    timer.done({ outcome: 'error', reason: 'concurrent-submission-blocked' });
    return { error: 'A submission is already in progress. Please wait for it to complete.' };
  }

  ipcLogger.info('Timesheet submission initiated by user');

  try {
    isSubmissionInProgress = true;
    currentSubmissionAbortController = new AbortController();

    if (!params.token) {
      timer.done({ outcome: 'error', reason: 'no-session' });
      return { error: 'Session token is required. Please log in to submit timesheets.' };
    }

    const session = validateSession(params.token);
    if (!session.valid) {
      timer.done({ outcome: 'error', reason: 'invalid-session' });
      return { error: 'Session is invalid or expired. Please log in again.' };
    }

    if (session.isAdmin) {
      ipcLogger.warn('Admin attempted timesheet submission', { email: session.email });
      timer.done({ outcome: 'error', reason: 'admin-not-allowed' });
      return { error: 'Admin users cannot submit timesheet entries to SmartSheet.' };
    }

    ipcLogger.verbose('Checking credentials for submission', { service: 'smartsheet' });
    const credentials = getCredentials('smartsheet');
    ipcLogger.verbose('Credentials check result', { service: 'smartsheet', found: !!credentials });

    if (!credentials) {
      ipcLogger.warn('Submission: credentials not found', { service: 'smartsheet' });
      timer.done({ outcome: 'error', reason: 'credentials-not-found' });
      return { error: 'SmartSheet credentials not found. Please add your credentials to submit timesheets.' };
    }

    ipcLogger.verbose('Credentials retrieved, proceeding with submission', { service: 'smartsheet', email: credentials.email });

    let lastProgressTime = Date.now();
    let timeoutCheckInterval: NodeJS.Timeout | null = null;
    let submissionAborted = false;

    const pendingEntries = getPendingTimesheetEntries() as Array<{ id: number }>;
    const pendingEntryIds = pendingEntries.map(e => e.id);

    const progressCallback = (percent: number, message: string) => {
      lastProgressTime = Date.now();
      params.onProgress(percent, message, { pendingIds: pendingEntryIds });
      ipcLogger.verbose('Submission progress update', {
        percent,
        message,
        total: pendingEntryIds.length
      });
    };

    timeoutCheckInterval = setInterval(() => {
      const timeSinceLastProgress = Date.now() - lastProgressTime;
      const fiveMinutes = 5 * 60 * 1000;

      if (timeSinceLastProgress > fiveMinutes && !submissionAborted) {
        submissionAborted = true;
        ipcLogger.error('Submission timeout: no progress for 5 minutes', {
          timeSinceLastProgress,
          lastProgressTime: new Date(lastProgressTime).toISOString()
        });

        if (pendingEntryIds.length > 0) {
          resetTimesheetEntriesStatus(pendingEntryIds);
          ipcLogger.info('Reset entry status to pending after timeout', { count: pendingEntryIds.length });
        }

        if (timeoutCheckInterval) {
          clearInterval(timeoutCheckInterval);
          timeoutCheckInterval = null;
        }
      }
    }, 30000);

    try {
      const submitResult = await submitTimesheets(
        credentials.email,
        credentials.password,
        progressCallback,
        currentSubmissionAbortController?.signal,
        params.useMockWebsite
      );

      ipcLogger.info('submitTimesheets completed', {
        ok: submitResult.ok,
        successCount: submitResult.successCount,
        totalProcessed: submitResult.totalProcessed
      });

      if (timeoutCheckInterval) {
        clearInterval(timeoutCheckInterval);
        timeoutCheckInterval = null;
      }

      if (submissionAborted) {
        ipcLogger.warn('Submission was aborted by timeout', { submitResult });
        return {
          error:
            'Submission timed out after 5 minutes of no progress. Entries have been reset to pending status. Please try again.'
        };
      }

      if (!submitResult.ok) {
        ipcLogger.warn('Timesheet submission failed', {
          submitResult,
          successCount: submitResult.successCount,
          removedCount: submitResult.removedCount,
          totalProcessed: submitResult.totalProcessed
        });
      }

      ipcLogger.info('Timesheet submission completed successfully', { submitResult, dbPath: getDbPath() });
      timer.done({ outcome: 'success', submitResult });

      return { submitResult, dbPath: getDbPath() };
    } finally {
      if (timeoutCheckInterval) {
        clearInterval(timeoutCheckInterval);
      }
    }
  } catch (err: unknown) {
    const errorCode = extractErrorCode(err);
    const errorMessage = createUserFriendlyMessage(err);
    const errorDetails = err instanceof Error
      ? { code: errorCode, message: errorMessage, name: err.name, stack: err.stack }
      : { code: errorCode, message: errorMessage };

    ipcLogger.error('Timesheet submission failed', errorDetails);
    timer.done({ outcome: 'error', errorCode });
    return { error: errorMessage };
  } finally {
    isSubmissionInProgress = false;
    currentSubmissionAbortController = null;
  }
}


