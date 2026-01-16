import { ipcLogger } from '@sheetpilot/shared/logger';
import { getDb } from '@/models';
import { validateInput } from '@/validation/validate-ipc-input';
import { saveDraftSchema } from '@/validation/ipc-schemas';
import { isTrustedIpcSender } from './main-window';
import type { DraftRowEntry, DraftRowPayload } from './drafts.types';

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
