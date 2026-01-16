import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';

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

type DraftPayload = {
  id?: number;
  date?: string;
  hours?: number;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
};

const buildDraftPayload = (row: TimesheetRow): DraftPayload => {
  const payload: DraftPayload = {};

  if (row.id !== undefined) payload.id = row.id;
  if (row.date) payload.date = row.date;
  if (row.hours !== undefined && row.hours !== null) payload.hours = row.hours;
  if (row.project) payload.project = row.project;
  if (row.tool !== undefined) payload.tool = row.tool ?? null;
  if (row.chargeCode !== undefined) payload.chargeCode = row.chargeCode ?? null;
  if (row.taskDescription) payload.taskDescription = row.taskDescription;

  return payload;
};

export async function submitTimesheet(token: string, useMockWebsite?: boolean): Promise<SubmitResponse> {
  if (!window.timesheet?.submit) {
    window.logger?.warn('Submit not available');
    return { error: 'Timesheet API not available' };
  }
  return window.timesheet.submit(token, useMockWebsite);
}

export async function cancelTimesheetSubmission(): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!window.timesheet?.cancel) {
    return { success: false, error: 'Timesheet API not available' };
  }
  return window.timesheet.cancel();
}

export async function devSimulateSuccess(): Promise<{ success: boolean; count?: number; error?: string }> {
  if (!window.timesheet?.devSimulateSuccess) {
    return { success: false, error: 'Timesheet API not available' };
  }
  return window.timesheet.devSimulateSuccess();
}

export async function saveDraft(row: TimesheetRow): Promise<{ success: boolean; entry?: TimesheetRow; error?: string }> {
  if (!window.timesheet?.saveDraft) {
    return { success: false, error: 'Timesheet API not available' };
  }
  // Build payload with only present fields to support partial draft saves.
  const payload = buildDraftPayload(row);
  const res = await window.timesheet.saveDraft(payload);
  if (res.success && res.entry) {
    return { success: true, entry: res.entry };
  }
  return { success: false, error: res.error || 'Unknown error' };
}

export async function loadDraft(): Promise<{ success: boolean; entries?: TimesheetRow[]; error?: string }> {
  if (!window.timesheet?.loadDraft) {
    return { success: false, error: 'Timesheet API not available', entries: [] };
  }
  return window.timesheet.loadDraft() as Promise<{ success: boolean; entries?: TimesheetRow[]; error?: string }>;
}

export async function loadDraftById(id: number): Promise<{ success: boolean; entry?: TimesheetRow; error?: string }> {
  if (!window.timesheet?.loadDraftById) {
    return { success: false, error: 'Timesheet API not available' };
  }
  return window.timesheet.loadDraftById(id) as Promise<{ success: boolean; entry?: TimesheetRow; error?: string }>;
}

export async function deleteDraft(id: number): Promise<{ success: boolean; error?: string }> {
  if (!window.timesheet?.deleteDraft) {
    return { success: false, error: 'Timesheet API not available' };
  }
  return window.timesheet.deleteDraft(id);
}

export async function resetInProgress(): Promise<{ success: boolean; count?: number; error?: string }> {
  if (!window.timesheet?.resetInProgress) {
    return { success: false, error: 'Timesheet API not available' };
  }
  return window.timesheet.resetInProgress();
}

export async function exportToCSV(): Promise<{ success: boolean; csvContent?: string; entryCount?: number; filename?: string; error?: string }> {
  if (!window.timesheet?.exportToCSV) {
    return { success: false, error: 'Timesheet API not available' };
  }
  return window.timesheet.exportToCSV();
}

export function onSubmissionProgress(callback: (progress: { percent: number; current: number; total: number; message: string }) => void): void {
  window.timesheet?.onSubmissionProgress?.(callback);
}

export function removeProgressListener(): void {
  window.timesheet?.removeProgressListener?.();
}


