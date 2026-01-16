import { ipcLogger } from '@sheetpilot/shared/logger';
import { getDb, resetInProgressTimesheetEntries } from '@/models';
import { validateInput } from '@/validation/validate-ipc-input';
import { deleteDraftSchema } from '@/validation/ipc-schemas';
import { isTrustedIpcSender } from './main-window';
import type { DraftRowEntry } from './drafts.types';

export const handleDeleteDraft = async (
  event: Electron.IpcMainInvokeEvent,
  id: number
) => {
  const timer = ipcLogger.startTimer('delete-draft');

  if (!isTrustedIpcSender(event)) {
    timer.done({ outcome: 'error', reason: 'unauthorized' });
    return {
      success: false,
      error: 'Could not delete draft: unauthorized request',
    };
  }

  const validation = validateInput(
    deleteDraftSchema,
    { id },
    'timesheet:deleteDraft'
  );
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  const validatedData = validation.data!;

  try {
    ipcLogger.verbose('Deleting timesheet entry', { id: validatedData.id });
    const db = getDb();

    const checkStmt = db.prepare(
      `SELECT id, status FROM timesheet WHERE id = ?`
    );
    const entry = checkStmt.get(validatedData.id) as
      | { id: number; status: string | null }
      | undefined;

    if (entry) {
      ipcLogger.info('Deleting entry with status', {
        id: validatedData.id,
        status: entry.status,
      });
    }

    const deleteStmt = db.prepare(`
        DELETE FROM timesheet 
        WHERE id = ?
      `);

    const result = deleteStmt.run(validatedData.id);

    if (result.changes === 0) {
      ipcLogger.warn('Entry not found to delete', { id: validatedData.id });
      timer.done({ outcome: 'not_found' });
      return { success: false, error: 'Entry not found' };
    }

    ipcLogger.info('Timesheet entry deleted', {
      id: validatedData.id,
      changes: result.changes,
      previousStatus: entry?.status,
    });
    timer.done({ changes: result.changes });
    return { success: true };
  } catch (err: unknown) {
    ipcLogger.error('Could not delete timesheet entry', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    timer.done({ outcome: 'error', error: errorMessage });
    return { success: false, error: errorMessage };
  }
};

const formatDraftEntry = (entry: DraftRowEntry) => ({
  id: entry.id,
  date: entry.date,
  hours: entry.hours ?? undefined,
  project: entry.project,
  tool: entry.tool || null,
  chargeCode: entry.detail_charge_code || null,
  taskDescription: entry.task_description,
});

const toDraftEntriesResponse = (entries: DraftRowEntry[]) => {
  const gridData = entries.map((entry) => formatDraftEntry(entry));
  const entriesToReturn = gridData.length > 0 ? gridData : [{}];
  return { gridData, entriesToReturn };
};

export const handleLoadDraft = async (
  event: Electron.IpcMainInvokeEvent
) => {
  const timer = ipcLogger.startTimer('load-draft');
  if (!isTrustedIpcSender(event)) {
    timer.done({ outcome: 'error', reason: 'unauthorized' });
    return {
      success: false,
      error: 'Could not load draft: unauthorized request',
      entries: [],
    };
  }
  try {
    const resetCount = resetInProgressTimesheetEntries();
    if (resetCount > 0) {
      ipcLogger.info('Reset in-progress entries to NULL on page reload', {
        count: resetCount,
      });
    }

    ipcLogger.verbose('Loading draft timesheet entries');

    const db = getDb();
    const getPending = db.prepare(`
        SELECT * FROM timesheet 
        WHERE status IS NULL
        ORDER BY date ASC, hours ASC
      `);

    const entries = getPending.all() as DraftRowEntry[];

    const { gridData, entriesToReturn } = toDraftEntriesResponse(entries);

    ipcLogger.info('Draft timesheet entries loaded', {
      count: gridData.length,
    });
    timer.done({ count: gridData.length });

    return { success: true, entries: entriesToReturn };
  } catch (err: unknown) {
    ipcLogger.error('Could not load draft timesheet entries', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    timer.done({ outcome: 'error', error: errorMessage });
    return { success: false, error: errorMessage, entries: [] };
  }
};

export const handleLoadDraftById = async (
  event: Electron.IpcMainInvokeEvent,
  id: number
) => {
  const timer = ipcLogger.startTimer('load-draft-by-id');
  if (!isTrustedIpcSender(event)) {
    timer.done({ outcome: 'error', reason: 'unauthorized' });
    return {
      success: false,
      error: 'Could not load draft by ID: unauthorized request',
    };
  }
  try {
    if (!id || typeof id !== 'number') {
      timer.done({ outcome: 'error', error: 'invalid-id' });
      return { success: false, error: 'Invalid ID provided' };
    }

    ipcLogger.verbose('Loading draft timesheet entry by ID', { id });

    const db = getDb();
    const getEntry = db.prepare(`
        SELECT * FROM timesheet 
        WHERE id = ? AND status IS NULL
      `);

    const entry = getEntry.get(id) as DraftRowEntry | undefined;

    if (!entry) {
      ipcLogger.warn('Draft timesheet entry not found', { id });
      timer.done({ outcome: 'not-found' });
      return { success: false, error: 'Entry not found or already submitted' };
    }

    const gridEntry = formatDraftEntry(entry);

    ipcLogger.verbose('Draft timesheet entry loaded by ID', { id });
    timer.done({ found: true });
    return { success: true, entry: gridEntry };
  } catch (err: unknown) {
    ipcLogger.error('Could not load draft timesheet entry by ID', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    timer.done({ outcome: 'error', error: errorMessage });
    return { success: false, error: errorMessage };
  }
};
