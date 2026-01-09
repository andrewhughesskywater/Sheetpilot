import { ipcLogger } from './utils/logger';
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

function validateSubmissionRequest(token: string, timer: ReturnType<typeof ipcLogger.startTimer>): { valid: boolean; session?: ReturnType<typeof validateSession>; error?: string } {
  if (!token) {
    timer.done({ outcome: 'error', reason: 'no-session' });
    return { valid: false, error: 'Session token is required. Please log in to submit timesheets.' };
  }

  const session = validateSession(token);
  if (!session.valid) {
    timer.done({ outcome: 'error', reason: 'invalid-session' });
    return { valid: false, error: 'Session is invalid or expired. Please log in again.' };
  }

  if (session.isAdmin) {
    ipcLogger.warn('Admin attempted timesheet submission', { email: session.email });
    timer.done({ outcome: 'error', reason: 'admin-not-allowed' });
    return { valid: false, error: 'Admin users cannot submit timesheet entries to SmartSheet.' };
  }

  return { valid: true, session };
}

function getSubmissionCredentials(): { credentials: ReturnType<typeof getCredentials>; error?: string } {
  ipcLogger.verbose('Checking credentials for submission', { service: 'smartsheet' });
  const credentials = getCredentials('smartsheet');
  ipcLogger.verbose('Credentials check result', { service: 'smartsheet', found: !!credentials });

  if (!credentials) {
    ipcLogger.warn('Submission: credentials not found', { service: 'smartsheet' });
    return { credentials: null, error: 'SmartSheet credentials not found. Please add your credentials to submit timesheets.' };
  }

  ipcLogger.verbose('Credentials retrieved, proceeding with submission', { service: 'smartsheet', email: credentials.email });
  return { credentials };
}

function setupTimeoutMonitor(
  pendingEntryIds: number[],
  lastProgressTimeRef: { current: number },
  submissionAbortedRef: { current: boolean }
): NodeJS.Timeout {
  return setInterval(() => {
    const timeSinceLastProgress = Date.now() - lastProgressTimeRef.current;
    const fiveMinutes = 5 * 60 * 1000;

    if (timeSinceLastProgress > fiveMinutes && !submissionAbortedRef.current) {
      submissionAbortedRef.current = true;
      ipcLogger.error('Submission timeout: no progress for 5 minutes', {
        timeSinceLastProgress,
        lastProgressTime: new Date(lastProgressTimeRef.current).toISOString()
      });

      if (pendingEntryIds.length > 0) {
        resetTimesheetEntriesStatus(pendingEntryIds);
        ipcLogger.info('Reset entry status to pending after timeout', { count: pendingEntryIds.length });
      }
    }
  }, 30000);
}

async function executeSubmission(
  credentials: NonNullable<ReturnType<typeof getCredentials>>,
  progressCallback: (percent: number, message: string) => void,
  abortSignal: AbortSignal | undefined,
  useMockWebsite: boolean | undefined
): Promise<ReturnType<typeof submitTimesheets>> {
  return await submitTimesheets({
    email: credentials.email,
    password: credentials.password,
    progressCallback,
    abortSignal,
    useMockWebsite
  });
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

    const validation = validateSubmissionRequest(params.token, timer);
    if (!validation.valid) {
      return { error: validation.error! };
    }

    const credentialsCheck = getSubmissionCredentials();
    if (!credentialsCheck.credentials) {
      timer.done({ outcome: 'error', reason: 'credentials-not-found' });
      return { error: credentialsCheck.error! };
    }

    const lastProgressTimeRef = { current: Date.now() };
    const submissionAbortedRef = { current: false };
    const pendingEntries = getPendingTimesheetEntries() as Array<{ id: number }>;
    const pendingEntryIds = pendingEntries.map(e => e.id);

    const progressCallback = (percent: number, message: string) => {
      lastProgressTimeRef.current = Date.now();
      params.onProgress(percent, message, { pendingIds: pendingEntryIds });
      ipcLogger.verbose('Submission progress update', {
        percent,
        message,
        total: pendingEntryIds.length
      });
    };

    const timeoutCheckInterval = setupTimeoutMonitor(pendingEntryIds, lastProgressTimeRef, submissionAbortedRef);

    try {
      const submitResult = await executeSubmission(
        credentialsCheck.credentials,
        progressCallback,
        currentSubmissionAbortController?.signal,
        params.useMockWebsite
      );

      ipcLogger.info('submitTimesheets completed', {
        ok: submitResult.ok,
        successCount: submitResult.successCount,
        totalProcessed: submitResult.totalProcessed
      });

      clearInterval(timeoutCheckInterval);

      if (submissionAbortedRef.current) {
        ipcLogger.warn('Submission was aborted by timeout', { submitResult });
        return {
          error: 'Submission timed out after 5 minutes of no progress. Entries have been reset to pending status. Please try again.'
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
      clearInterval(timeoutCheckInterval);
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


