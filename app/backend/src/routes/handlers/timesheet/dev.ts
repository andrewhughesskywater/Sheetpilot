import { ipcMain } from 'electron';
import { ipcLogger } from '@sheetpilot/shared/logger';
import { getDb } from '@/models';
import { isTrustedIpcSender } from './main-window';

export function registerTimesheetDevHandlers(): void {
  ipcMain.handle('timesheet:devSimulateSuccess', async (event) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not simulate success: unauthorized request' };
    }
    if (process.env['NODE_ENV'] === 'production') {
      ipcLogger.warn('Dev simulate success called in production - blocking');
      return { success: false, error: 'Not available in production' };
    }

    ipcLogger.info('[DEV] Simulating successful submission');

    try {
      const db = getDb();

      const getPending = db.prepare(`
        SELECT id FROM timesheet WHERE status IS NULL
      `);
      const pendingEntries = getPending.all() as Array<{ id: number }>;

      if (pendingEntries.length === 0) {
        ipcLogger.info('[DEV] No pending entries to mark as complete');
        return { success: true, count: 0 };
      }

      const ids = pendingEntries.map((e) => e.id);
      const placeholders = ids.map(() => '?').join(',');

      const markComplete = db.prepare(`
        UPDATE timesheet 
        SET status = 'Complete',
            submitted_at = datetime('now')
        WHERE id IN (${placeholders})
      `);

      const result = markComplete.run(...ids);

      ipcLogger.info('[DEV] Marked entries as Complete', { count: result.changes, ids });
      return { success: true, count: result.changes };
    } catch (err: unknown) {
      ipcLogger.error('[DEV] Could not simulate success', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcLogger.verbose('Timesheet dev handlers registered');
}


