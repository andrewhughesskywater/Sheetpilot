import { ipcLogger } from '../utils/logger';
import { formatMinutesToTime, parseTimeToMinutes } from '@sheetpilot/shared/utils/format-conversions';
import { getDb, resetInProgressTimesheetEntries } from '../../repositories';
import { validateInput } from '../../validation/validate-ipc-input';
import { deleteDraftSchema, saveDraftSchema } from '../../validation/ipc-schemas';

export type SaveDraftInput = {
  id?: number | null;
  date?: string;
  timeIn?: string;
  timeOut?: string;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
};

export type SaveDraftResult =
  | {
      success: true;
      changes: number;
      id: number;
      entry?: {
        id: number;
        date: string;
        timeIn: string | null;
        timeOut: string | null;
        project: string | null;
        tool: string | null;
        chargeCode: string | null;
        taskDescription: string | null;
      };
    }
  | { success: false; error: string; changes?: number };

export type DeleteDraftResult = { success: boolean; error?: string; changes?: number };

export type LoadDraftResult = { success: boolean; error?: string; entries: Array<Record<string, unknown>> };

export type LoadDraftByIdResult = { success: boolean; error?: string; entry?: Record<string, unknown> };

export function saveDraftRequest(row: SaveDraftInput): SaveDraftResult {
  const timer = ipcLogger.startTimer('save-draft');
  const validation = validateInput(saveDraftSchema, row, 'timesheet:saveDraft');
  if (!validation.success) {
    timer.done({ outcome: 'error', error: 'validation-failed' });
    return { success: false, error: validation.error ?? 'Validation failed' };
  }

  const validatedRow = validation.data!;

  try {
    ipcLogger.verbose('Saving draft timesheet entry (partial data allowed)', {
      id: validatedRow.id,
      date: validatedRow.date,
      project: validatedRow.project
    });

    const { timeInMinutes, timeOutMinutes } = parseAndValidateTimes(validatedRow.timeIn, validatedRow.timeOut);

    const { changes, savedId, savedEntry } = runSaveTransaction({
      validatedRow,
      timeInMinutes,
      timeOutMinutes
    });

    ipcLogger.info('Draft timesheet entry saved', {
      id: savedId,
      changes,
      date: validatedRow.date,
      project: validatedRow.project
    });
    timer.done({ changes });

    if (savedEntry) {
      return {
        success: true,
        changes,
        id: savedId,
        entry: mapDbEntryToGrid(savedEntry)
      };
    }

    return { success: true, changes, id: savedId };
  } catch (err: unknown) {
    ipcLogger.error('Could not save draft timesheet entry', {
      date: validatedRow.date,
      project: validatedRow.project,
      error: err instanceof Error ? err.message : String(err)
    });
    const errorMessage = err instanceof Error ? err.message : String(err);
    timer.done({ outcome: 'error', error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

export function deleteDraftRequest(id: number): DeleteDraftResult {
  const timer = ipcLogger.startTimer('delete-draft');
  const validation = validateInput(deleteDraftSchema, { id }, 'timesheet:deleteDraft');
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  const validated = validation.data!;

  try {
    ipcLogger.verbose('Deleting timesheet entry', { id: validated.id });
    const db = getDb();

    const checkStmt = db.prepare(`SELECT id, status FROM timesheet WHERE id = ?`);
    const entry = checkStmt.get(validated.id) as { id: number; status: string | null } | undefined;

    if (entry) {
      ipcLogger.info('Deleting entry with status', { id: validated.id, status: entry.status });
    }

    const deleteStmt = db.prepare(`
        DELETE FROM timesheet 
        WHERE id = ?
      `);

    const result = deleteStmt.run(validated.id);

    if (result.changes === 0) {
      ipcLogger.warn('Entry not found to delete', { id: validated.id });
      timer.done({ outcome: 'not_found' });
      return { success: false, error: 'Entry not found' };
    }

    ipcLogger.info('Timesheet entry deleted', {
      id: validated.id,
      changes: result.changes,
      previousStatus: entry?.status
    });
    timer.done({ changes: result.changes });
    return { success: true, changes: result.changes };
  } catch (err: unknown) {
    ipcLogger.error('Could not delete timesheet entry', {
      entryId: validated.id,
      error: err instanceof Error ? err.message : String(err)
    });
    const errorMessage = err instanceof Error ? err.message : String(err);
    timer.done({ outcome: 'error', error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

export function loadDraftRequest(): LoadDraftResult {
  const timer = ipcLogger.startTimer('load-draft');
  try {
    const resetCount = resetInProgressTimesheetEntries();
    if (resetCount > 0) {
      ipcLogger.info('Reset in-progress entries to NULL on page reload', { count: resetCount });
    }

    ipcLogger.verbose('Loading draft timesheet entries');

    const db = getDb();
    const getPending = db.prepare(`
        SELECT * FROM timesheet 
        WHERE status IS NULL
        ORDER BY date ASC, time_in ASC
      `);

    const entries = getPending.all() as Array<DbEntry>;
    const gridData = entries.map(mapDbEntryToGrid);

    ipcLogger.info('Draft timesheet entries loaded', { count: gridData.length });
    timer.done({ count: gridData.length });

    const entriesToReturn = gridData.length > 0 ? gridData : [{}];
    return { success: true, entries: entriesToReturn };
  } catch (err: unknown) {
    ipcLogger.error('Could not load draft timesheet entries', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    timer.done({ outcome: 'error', error: errorMessage });
    return { success: false, error: errorMessage, entries: [] };
  }
}

export function loadDraftByIdRequest(id: number): LoadDraftByIdResult {
  const timer = ipcLogger.startTimer('load-draft-by-id');
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

    const entry = getEntry.get(id) as DbEntry | undefined;

    if (!entry) {
      ipcLogger.warn('Draft timesheet entry not found', { id });
      timer.done({ outcome: 'not-found' });
      return { success: false, error: 'Entry not found or already submitted' };
    }

    const gridEntry = mapDbEntryToGrid(entry);

    ipcLogger.verbose('Draft timesheet entry loaded by ID', { id });
    timer.done({ found: true });
    return { success: true, entry: gridEntry };
  } catch (err: unknown) {
    ipcLogger.error('Could not load draft timesheet entry by ID', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    timer.done({ outcome: 'error', error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

function parseAndValidateTimes(timeIn?: string, timeOut?: string): { timeInMinutes: number | null; timeOutMinutes: number | null } {
  let timeInMinutes: number | null = null;
  let timeOutMinutes: number | null = null;

  if (timeIn) {
    const parsed = parseTimeToMinutes(timeIn);
    timeInMinutes = parsed;
    if (parsed % 15 !== 0) {
      throw new Error('Time In must be in 15-minute increments');
    }
  }

  if (timeOut) {
    const parsed = parseTimeToMinutes(timeOut);
    timeOutMinutes = parsed;
    if (parsed % 15 !== 0) {
      throw new Error('Time Out must be in 15-minute increments');
    }
  }

  if (timeInMinutes !== null && timeOutMinutes !== null && timeOutMinutes <= timeInMinutes) {
    throw new Error('Time Out must be after Time In');
  }

  return { timeInMinutes, timeOutMinutes };
}

function buildUpdateFieldsAndValues(
  validatedRow: SaveDraftInput,
  timeInMinutes: number | null,
  timeOutMinutes: number | null
): { fields: string[]; values: (string | number | null)[] } {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (validatedRow.date !== undefined) {
    fields.push('date = ?');
    values.push(validatedRow.date);
  }
  if (timeInMinutes !== null) {
    fields.push('time_in = ?');
    values.push(timeInMinutes);
  }
  if (timeOutMinutes !== null) {
    fields.push('time_out = ?');
    values.push(timeOutMinutes);
  }
  if (validatedRow.project !== undefined) {
    fields.push('project = ?');
    values.push(validatedRow.project);
  }
  if (validatedRow.tool !== undefined) {
    fields.push('tool = ?');
    values.push(validatedRow.tool || null);
  }
  if (validatedRow.chargeCode !== undefined) {
    fields.push('detail_charge_code = ?');
    values.push(validatedRow.chargeCode || null);
  }
  if (validatedRow.taskDescription !== undefined) {
    fields.push('task_description = ?');
    values.push(validatedRow.taskDescription);
  }

  return { fields, values };
}

function updateExistingEntry(
  db: ReturnType<typeof getDb>,
  validatedRow: SaveDraftInput,
  timeInMinutes: number | null,
  timeOutMinutes: number | null
): { changes: number; savedId: number } {
  ipcLogger.debug('Updating existing timesheet entry (partial data allowed)', { id: validatedRow.id });

  const { fields, values } = buildUpdateFieldsAndValues(validatedRow, timeInMinutes, timeOutMinutes);
  
  if (fields.length === 0) {
    return { changes: 0, savedId: validatedRow.id! };
  }

  const updateSql = `UPDATE timesheet SET ${fields.join(', ')} WHERE id = ? AND status IS NULL`;
  const update = db.prepare(updateSql);
  const result = update.run(...values, validatedRow.id);
  
  if (!result) {
    throw new Error('Failed to update timesheet entry');
  }
  
  return { changes: result.changes, savedId: validatedRow.id! };
}

function insertNewEntry(
  db: ReturnType<typeof getDb>,
  validatedRow: SaveDraftInput,
  timeInMinutes: number | null,
  timeOutMinutes: number | null
): { changes: number; savedId: number } {
  ipcLogger.debug('Inserting new timesheet entry (partial data allowed)');
  
  const insert = db.prepare(`
    INSERT INTO timesheet
    (date, time_in, time_out, project, tool, detail_charge_code, task_description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `);

  const result = insert.run(
    validatedRow.date || null,
    timeInMinutes,
    timeOutMinutes,
    validatedRow.project || null,
    validatedRow.tool || null,
    validatedRow.chargeCode || null,
    validatedRow.taskDescription || null
  );

  if (!result) {
    throw new Error('Failed to insert timesheet entry');
  }
  
  const savedId = typeof result.lastInsertRowid === 'bigint' 
    ? Number(result.lastInsertRowid) 
    : result.lastInsertRowid;
    
  return { changes: result.changes, savedId };
}

function runSaveTransaction(params: {
  validatedRow: SaveDraftInput;
  timeInMinutes: number | null;
  timeOutMinutes: number | null;
}): { changes: number; savedId: number; savedEntry?: DbEntry } {
  const db = getDb();
  const { validatedRow, timeInMinutes, timeOutMinutes } = params;

  const saveTransaction = db.transaction(() => {
    const isUpdate = validatedRow.id !== undefined && validatedRow.id !== null;
    
    const { changes, savedId } = isUpdate
      ? updateExistingEntry(db, validatedRow, timeInMinutes, timeOutMinutes)
      : insertNewEntry(db, validatedRow, timeInMinutes, timeOutMinutes);

    const getEntry = db.prepare(`SELECT * FROM timesheet WHERE id = ?`);
    const savedEntry = getEntry.get(savedId) as DbEntry | undefined;

    return { changes, savedId, savedEntry };
  });

  return saveTransaction();
}

function mapDbEntryToGrid(entry: DbEntry): {
  id: number;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  project: string | null;
  tool: string | null;
  chargeCode: string | null;
  taskDescription: string | null;
} {
  return {
    id: entry.id,
    date: entry.date,
    timeIn: formatMinutesToTime(entry.time_in),
    timeOut: formatMinutesToTime(entry.time_out),
    project: entry.project,
    tool: entry.tool || null,
    chargeCode: entry.detail_charge_code || null,
    taskDescription: entry.task_description
  };
}

type DbEntry = {
  id: number;
  date: string;
  time_in: number;
  time_out: number;
  project: string;
  tool?: string | null;
  detail_charge_code?: string | null;
  task_description: string;
};
