import { ipcMain } from 'electron';
import { ipcLogger } from '@sheetpilot/shared/logger';
import { getDb, resetInProgressTimesheetEntries } from '@/models';
import { validateInput } from '@/validation/validate-ipc-input';
import { deleteDraftSchema, saveDraftSchema } from '@/validation/ipc-schemas';
import { isTrustedIpcSender } from './main-window';

export function registerTimesheetDraftHandlers(): void {
  ipcMain.handle(
    'timesheet:saveDraft',
    async (
      event,
      row: {
        id?: number;
        date?: string;
        hours?: number;
        project?: string;
        tool?: string | null;
        chargeCode?: string | null;
        taskDescription?: string;
      }
    ) => {
      const timer = ipcLogger.startTimer('save-draft');

      if (!isTrustedIpcSender(event)) {
        timer.done({ outcome: 'error', reason: 'unauthorized' });
        return { success: false, error: 'Could not save draft: unauthorized request' };
      }

      const validation = validateInput(saveDraftSchema, row, 'timesheet:saveDraft');
      if (!validation.success) {
        timer.done({ outcome: 'error', error: 'validation-failed' });
        return { success: false, error: validation.error };
      }

      const validatedRow = validation.data!;

      try {
        ipcLogger.verbose('Saving draft timesheet entry (partial data allowed)', {
          id: validatedRow.id,
          date: validatedRow.date,
          hours: validatedRow.hours,
          project: validatedRow.project
        });

        const db = getDb();
        let result: { changes: number; lastInsertRowid: number | bigint } | undefined;
        let savedId: number;
        let savedEntry:
          | {
              id: number;
              date: string;
              hours: number | null;
              project: string;
              tool?: string | null;
              detail_charge_code?: string | null;
              task_description: string;
            }
          | undefined;

        const saveTransaction = db.transaction(() => {
          if (validatedRow.id !== undefined && validatedRow.id !== null) {
            ipcLogger.debug('Updating existing timesheet entry (partial data allowed)', { id: validatedRow.id });

            const updateFields: string[] = [];
            const updateValues: (string | number | null)[] = [];

            if (validatedRow.date !== undefined) {
              updateFields.push('date = ?');
              updateValues.push(validatedRow.date);
            }
            if (validatedRow.hours !== undefined && validatedRow.hours !== null) {
              updateFields.push('hours = ?');
              updateValues.push(validatedRow.hours);
            }
            if (validatedRow.project !== undefined) {
              updateFields.push('project = ?');
              updateValues.push(validatedRow.project);
            }
            if (validatedRow.tool !== undefined) {
              updateFields.push('tool = ?');
              updateValues.push(validatedRow.tool || null);
            }
            if (validatedRow.chargeCode !== undefined) {
              updateFields.push('detail_charge_code = ?');
              updateValues.push(validatedRow.chargeCode || null);
            }
            if (validatedRow.taskDescription !== undefined) {
              updateFields.push('task_description = ?');
              updateValues.push(validatedRow.taskDescription);
            }

            if (updateFields.length > 0) {
              const updateSql = `UPDATE timesheet SET ${updateFields.join(', ')} WHERE id = ? AND status IS NULL`;
              const update = db.prepare(updateSql);
              result = update.run(...updateValues, validatedRow.id);
            } else {
              result = { changes: 0, lastInsertRowid: validatedRow.id };
            }
            savedId = validatedRow.id;
          } else {
            ipcLogger.debug('Inserting new timesheet entry (partial data allowed)');
            const insert = db.prepare(`
              INSERT INTO timesheet
              (date, hours, project, tool, detail_charge_code, task_description, status)
              VALUES (?, ?, ?, ?, ?, ?, NULL)
            `);

            result = insert.run(
              validatedRow.date || null,
              validatedRow.hours || null,
              validatedRow.project || null,
              validatedRow.tool || null,
              validatedRow.chargeCode || null,
              validatedRow.taskDescription || null
            );

            savedId = typeof result.lastInsertRowid === 'bigint' ? Number(result.lastInsertRowid) : result.lastInsertRowid;
          }

          const getEntry = db.prepare(`SELECT * FROM timesheet WHERE id = ?`);
          savedEntry = getEntry.get(savedId) as
            | {
                id: number;
                date: string;
                hours: number | null;
                project: string;
                tool?: string | null;
                detail_charge_code?: string | null;
                task_description: string;
              }
            | undefined;

          return { result, savedId, savedEntry };
        });

        const transactionResult = saveTransaction();
        result = transactionResult.result;
        savedId = transactionResult.savedId;
        savedEntry = transactionResult.savedEntry;

        ipcLogger.info('Draft timesheet entry saved', {
          id: savedId,
          changes: result.changes,
          date: validatedRow.date,
          project: validatedRow.project
        });
        timer.done({ changes: result.changes });

        if (savedEntry) {
          return {
            success: true,
            changes: result.changes,
            id: savedId,
            entry: {
              id: savedEntry.id,
              date: savedEntry.date,
              hours: savedEntry.hours ?? 0,
              project: savedEntry.project,
              tool: savedEntry.tool || null,
              chargeCode: savedEntry.detail_charge_code || null,
              taskDescription: savedEntry.task_description
            }
          };
        }

        return { success: true, changes: result.changes, id: savedId };
      } catch (err: unknown) {
        ipcLogger.error('Could not save draft timesheet entry', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        timer.done({ outcome: 'error', error: errorMessage });
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle('timesheet:deleteDraft', async (event, id: number) => {
    const timer = ipcLogger.startTimer('delete-draft');

    if (!isTrustedIpcSender(event)) {
      timer.done({ outcome: 'error', reason: 'unauthorized' });
      return { success: false, error: 'Could not delete draft: unauthorized request' };
    }

    const validation = validateInput(deleteDraftSchema, { id }, 'timesheet:deleteDraft');
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      ipcLogger.verbose('Deleting timesheet entry', { id: validatedData.id });
      const db = getDb();

      const checkStmt = db.prepare(`SELECT id, status FROM timesheet WHERE id = ?`);
      const entry = checkStmt.get(validatedData.id) as { id: number; status: string | null } | undefined;

      if (entry) {
        ipcLogger.info('Deleting entry with status', { id: validatedData.id, status: entry.status });
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
        previousStatus: entry?.status
      });
      timer.done({ changes: result.changes });
      return { success: true };
    } catch (err: unknown) {
      ipcLogger.error('Could not delete timesheet entry', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('timesheet:loadDraft', async (event) => {
    const timer = ipcLogger.startTimer('load-draft');
    if (!isTrustedIpcSender(event)) {
      timer.done({ outcome: 'error', reason: 'unauthorized' });
      return { success: false, error: 'Could not load draft: unauthorized request', entries: [] };
    }
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
        ORDER BY date ASC, hours ASC
      `);

      const entries = getPending.all() as Array<{
        id: number;
        date: string;
        hours: number | null;
        project: string;
        tool?: string;
        detail_charge_code?: string;
        task_description: string;
      }>;

      const gridData = entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        hours: entry.hours ?? undefined,
        project: entry.project,
        tool: entry.tool || null,
        chargeCode: entry.detail_charge_code || null,
        taskDescription: entry.task_description
      }));

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
  });

  ipcMain.handle('timesheet:loadDraftById', async (event, id: number) => {
    const timer = ipcLogger.startTimer('load-draft-by-id');
    if (!isTrustedIpcSender(event)) {
      timer.done({ outcome: 'error', reason: 'unauthorized' });
      return { success: false, error: 'Could not load draft by ID: unauthorized request' };
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

      const entry = getEntry.get(id) as
        | {
            id: number;
            date: string;
            hours: number | null;
            project: string;
            tool?: string | null;
            detail_charge_code?: string | null;
            task_description: string;
          }
        | undefined;

      if (!entry) {
        ipcLogger.warn('Draft timesheet entry not found', { id });
        timer.done({ outcome: 'not-found' });
        return { success: false, error: 'Entry not found or already submitted' };
      }

      const gridEntry = {
        id: entry.id,
        date: entry.date,
        hours: entry.hours ?? undefined,
        project: entry.project,
        tool: entry.tool || null,
        chargeCode: entry.detail_charge_code || null,
        taskDescription: entry.task_description
      };

      ipcLogger.verbose('Draft timesheet entry loaded by ID', { id });
      timer.done({ found: true });
      return { success: true, entry: gridEntry };
    } catch (err: unknown) {
      ipcLogger.error('Could not load draft timesheet entry by ID', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  ipcLogger.verbose('Timesheet draft handlers registered');
}


