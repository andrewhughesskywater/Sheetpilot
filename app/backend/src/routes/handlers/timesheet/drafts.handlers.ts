import { ipcLogger } from '@sheetpilot/shared/logger';
import { getDb, resetInProgressTimesheetEntries } from '@/models';
import { validateInput } from '@/validation/validate-ipc-input';
import { deleteDraftSchema, saveDraftSchema } from '@/validation/ipc-schemas';
import { isTrustedIpcSender } from './main-window';

type DraftRowPayload = {
  id?: number;
  date?: string;
  hours?: number;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
};

type DraftRowEntry = {
  id: number;
  date: string;
  hours: number | null;
  project: string;
  tool?: string | null;
  detail_charge_code?: string | null;
  task_description: string;
};

type DraftSaveResult = {
  changes: number;
  lastInsertRowid: number | bigint;
};

type UpdateData = {
  updateFields: string[];
  updateValues: Array<string | number | null>;
};

type SaveDraftTransactionResult = {
  result: DraftSaveResult;
  savedId: number;
  savedEntry: DraftRowEntry | undefined;
};

const getUpdateData = (validatedRow: DraftRowPayload): UpdateData => {
  const updateCandidates = [
    {
      field: 'date',
      value: validatedRow.date,
      include: validatedRow.date !== undefined,
    },
    {
      field: 'hours',
      value: validatedRow.hours,
      include:
        validatedRow.hours !== undefined && validatedRow.hours !== null,
    },
    {
      field: 'project',
      value: validatedRow.project,
      include: validatedRow.project !== undefined,
    },
    {
      field: 'tool',
      value: validatedRow.tool || null,
      include: validatedRow.tool !== undefined,
    },
    {
      field: 'detail_charge_code',
      value: validatedRow.chargeCode || null,
      include: validatedRow.chargeCode !== undefined,
    },
    {
      field: 'task_description',
      value: validatedRow.taskDescription,
      include: validatedRow.taskDescription !== undefined,
    },
  ];

  const filteredCandidates = updateCandidates.filter(
    (candidate) => candidate.include
  );

  return {
    updateFields: filteredCandidates.map(
      (candidate) => `${candidate.field} = ?`
    ),
    updateValues: filteredCandidates.map((candidate) => candidate.value),
  };
};

const runUpdate = (
  db: ReturnType<typeof getDb>,
  validatedRow: DraftRowPayload,
  updateData: UpdateData
): { result: DraftSaveResult; savedId: number } => {
  if (updateData.updateFields.length === 0 || validatedRow.id === undefined) {
    return {
      result: {
        changes: 0,
        lastInsertRowid: validatedRow.id ?? 0,
      },
      savedId: validatedRow.id ?? 0,
    };
  }

  const updateSql = `UPDATE timesheet SET ${updateData.updateFields.join(', ')} WHERE id = ? AND status IS NULL`;
  const update = db.prepare(updateSql);
  const result = update.run(...updateData.updateValues, validatedRow.id);
  return { result, savedId: validatedRow.id };
};

const runInsert = (
  db: ReturnType<typeof getDb>,
  validatedRow: DraftRowPayload
): DraftSaveResult => {
  const insert = db.prepare(`
      INSERT INTO timesheet
      (date, hours, project, tool, detail_charge_code, task_description, status)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `);

  return insert.run(
    validatedRow.date || null,
    validatedRow.hours || null,
    validatedRow.project || null,
    validatedRow.tool || null,
    validatedRow.chargeCode || null,
    validatedRow.taskDescription || null
  );
};

const getSavedEntry = (
  db: ReturnType<typeof getDb>,
  savedId: number
): DraftRowEntry | undefined => {
  const getEntry = db.prepare(`SELECT * FROM timesheet WHERE id = ?`);
  return getEntry.get(savedId) as DraftRowEntry | undefined;
};

const saveDraftEntry = (
  db: ReturnType<typeof getDb>,
  validatedRow: DraftRowPayload
): SaveDraftTransactionResult => {
  if (validatedRow.id !== undefined && validatedRow.id !== null) {
    ipcLogger.debug(
      'Updating existing timesheet entry (partial data allowed)',
      { id: validatedRow.id }
    );
    const updateData = getUpdateData(validatedRow);
    const { result, savedId } = runUpdate(db, validatedRow, updateData);
    return {
      result,
      savedId,
      savedEntry: getSavedEntry(db, savedId),
    };
  }

  ipcLogger.debug('Inserting new timesheet entry (partial data allowed)');
  const result = runInsert(db, validatedRow);
  const savedId =
    typeof result.lastInsertRowid === 'bigint'
      ? Number(result.lastInsertRowid)
      : result.lastInsertRowid;
  return {
    result,
    savedId,
    savedEntry: getSavedEntry(db, savedId),
  };
};

const formatSavedEntry = (savedEntry: DraftRowEntry) => ({
  id: savedEntry.id,
  date: savedEntry.date,
  hours: savedEntry.hours ?? 0,
  project: savedEntry.project,
  tool: savedEntry.tool || null,
  chargeCode: savedEntry.detail_charge_code || null,
  taskDescription: savedEntry.task_description,
});

const buildSaveDraftResponse = (
  result: DraftSaveResult,
  savedId: number,
  savedEntry?: DraftRowEntry
) => {
  if (savedEntry) {
    return {
      success: true,
      changes: result.changes,
      id: savedId,
      entry: formatSavedEntry(savedEntry),
    };
  }

  return { success: true, changes: result.changes, id: savedId };
};

export const handleSaveDraft = async (
  event: Electron.IpcMainInvokeEvent,
  row: DraftRowPayload
) => {
  const timer = ipcLogger.startTimer('save-draft');

  if (!isTrustedIpcSender(event)) {
    timer.done({ outcome: 'error', reason: 'unauthorized' });
    return {
      success: false,
      error: 'Could not save draft: unauthorized request',
    };
  }

  const validation = validateInput(
    saveDraftSchema,
    row,
    'timesheet:saveDraft'
  );
  if (!validation.success) {
    timer.done({ outcome: 'error', error: 'validation-failed' });
    return { success: false, error: validation.error };
  }

  const validatedRow = validation.data!;

  try {
    ipcLogger.verbose(
      'Saving draft timesheet entry (partial data allowed)',
      {
        id: validatedRow.id,
        date: validatedRow.date,
        hours: validatedRow.hours,
        project: validatedRow.project,
      }
    );

    const db = getDb();
    const saveTransaction = db.transaction(() =>
      saveDraftEntry(db, validatedRow)
    );
    const { result, savedId, savedEntry } = saveTransaction();

    ipcLogger.info('Draft timesheet entry saved', {
      id: savedId,
      changes: result.changes,
      date: validatedRow.date,
      project: validatedRow.project,
    });
    timer.done({ changes: result.changes });

    return buildSaveDraftResponse(result, savedId, savedEntry);
  } catch (err: unknown) {
    ipcLogger.error('Could not save draft timesheet entry', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    timer.done({ outcome: 'error', error: errorMessage });
    return { success: false, error: errorMessage };
  }
};

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
