import type { TimesheetRow } from '../../components/timesheet/timesheet.schema';

const TIMESHEET_API_UNAVAILABLE_ERROR = 'Timesheet API not available';

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

export async function submitTimesheet(token: string, useMockWebsite?: boolean): Promise<SubmitResponse> {
  if (!window.timesheet?.submit) {
    window.logger?.warn('Submit not available');
    return { error: TIMESHEET_API_UNAVAILABLE_ERROR };
  }
  return window.timesheet.submit(token, useMockWebsite);
}

export async function cancelTimesheetSubmission(): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!window.timesheet?.cancel) {
    return { success: false, error: TIMESHEET_API_UNAVAILABLE_ERROR };
  }
  return window.timesheet.cancel();
}

export async function devSimulateSuccess(): Promise<{ success: boolean; count?: number; error?: string }> {
  if (!window.timesheet?.devSimulateSuccess) {
    return { success: false, error: TIMESHEET_API_UNAVAILABLE_ERROR };
  }
  return window.timesheet.devSimulateSuccess();
}

export async function saveDraft(row: TimesheetRow): Promise<{ success: boolean; entry?: TimesheetRow; error?: string }> {
  if (!window.timesheet?.saveDraft) {
    return { success: false, error: TIMESHEET_API_UNAVAILABLE_ERROR };
  }
  // Build payload with only present fields to support partial draft saves.
  const payload: {
    id?: number;
    date?: string;
    timeIn?: string;
    timeOut?: string;
    project?: string;
    tool?: string | null;
    chargeCode?: string | null;
    taskDescription?: string;
  } = {};

  if (row.id !== undefined) payload.id = row.id;
  if (row.date) payload.date = row.date;
  if (row.timeIn) payload.timeIn = row.timeIn;
  if (row.timeOut) payload.timeOut = row.timeOut;
  if (row.project) payload.project = row.project;
  if (row.tool !== undefined) payload.tool = row.tool ?? null;
  if (row.chargeCode !== undefined) payload.chargeCode = row.chargeCode ?? null;
  if (row.taskDescription) payload.taskDescription = row.taskDescription;

  const res = await window.timesheet.saveDraft(payload);
  if (res.success && res.entry) {
    return { success: true, entry: res.entry };
  }
  return { success: false, error: res.error || 'Unknown error' };
}

export async function loadDraft(): Promise<{ success: boolean; entries?: TimesheetRow[]; error?: string }> {
  if (!window.timesheet?.loadDraft) {
    return { success: false, error: TIMESHEET_API_UNAVAILABLE_ERROR, entries: [] };
  }
  return window.timesheet.loadDraft() as Promise<{ success: boolean; entries?: TimesheetRow[]; error?: string }>;
}

export async function loadDraftById(id: number): Promise<{ success: boolean; entry?: TimesheetRow; error?: string }> {
  if (!window.timesheet?.loadDraftById) {
    return { success: false, error: TIMESHEET_API_UNAVAILABLE_ERROR };
  }
  return window.timesheet.loadDraftById(id) as Promise<{ success: boolean; entry?: TimesheetRow; error?: string }>;
}

export async function deleteDraft(id: number): Promise<{ success: boolean; error?: string }> {
  if (!window.timesheet?.deleteDraft) {
    return { success: false, error: TIMESHEET_API_UNAVAILABLE_ERROR };
  }
  return window.timesheet.deleteDraft(id);
}

export async function resetInProgress(): Promise<{ success: boolean; count?: number; error?: string }> {
  if (!window.timesheet?.resetInProgress) {
    return { success: false, error: TIMESHEET_API_UNAVAILABLE_ERROR };
  }
  return window.timesheet.resetInProgress();
}

export async function exportToCSV(): Promise<{ success: boolean; csvContent?: string; entryCount?: number; filename?: string; error?: string }> {
  if (!window.timesheet?.exportToCSV) {
    return { success: false, error: TIMESHEET_API_UNAVAILABLE_ERROR };
  }
  return window.timesheet.exportToCSV();
}

export function onSubmissionProgress(callback: (progress: { percent: number; current: number; total: number; message: string }) => void): void {
  window.timesheet?.onSubmissionProgress?.(callback);
}

export function removeProgressListener(): void {
  window.timesheet?.removeProgressListener?.();
}


