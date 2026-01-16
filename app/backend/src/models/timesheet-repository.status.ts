import { dbLogger } from "@sheetpilot/shared/logger";
import { getDb } from "./connection-manager";

/**
 * Marks timesheet entries as in-progress
 */
export function markTimesheetEntriesAsInProgress(ids: number[]) {
  if (ids.length === 0) {
    dbLogger.debug("No entries to mark as in-progress");
    return;
  }

  const timer = dbLogger.startTimer("mark-entries-in-progress");
  const db = getDb();

  dbLogger.info("Marking timesheet entries as in-progress", {
    count: ids.length,
    ids,
  });
  const placeholders = ids.map(() => "?").join(",");
  const updateInProgress = db.prepare(`
        UPDATE timesheet 
        SET status = 'in_progress'
        WHERE id IN (${placeholders}) AND status IS NULL
    `);

  const result = updateInProgress.run(...ids);
  dbLogger.audit("mark-in-progress", "Entries marked as in-progress", {
    count: ids.length,
    changes: result.changes,
  });
  timer.done({ count: ids.length, changes: result.changes });
}

/**
 * Resets timesheet entries status back to NULL
 */
export function resetTimesheetEntriesStatus(ids: number[]) {
  if (ids.length === 0) {
    dbLogger.debug("No entries to reset status");
    return;
  }

  const timer = dbLogger.startTimer("reset-entries-status");
  const db = getDb();

  dbLogger.info("Resetting timesheet entries to NULL status", {
    count: ids.length,
    ids,
  });
  const placeholders = ids.map(() => "?").join(",");
  const resetStatus = db.prepare(`
        UPDATE timesheet 
        SET status = NULL
        WHERE id IN (${placeholders})
    `);

  const result = resetStatus.run(...ids);
  dbLogger.audit("reset-status", "Entries status reset to NULL", {
    count: ids.length,
    changes: result.changes,
  });
  timer.done({ count: ids.length, changes: result.changes });
}

/**
 * Marks timesheet entries as successfully submitted
 */
export function markTimesheetEntriesAsSubmitted(ids: number[]) {
  if (ids.length === 0) {
    dbLogger.debug("No entries to mark as submitted");
    return;
  }

  const timer = dbLogger.startTimer("mark-entries-submitted");
  const db = getDb();

  dbLogger.info("Marking timesheet entries as submitted", {
    count: ids.length,
    ids,
  });
  const placeholders = ids.map(() => "?").join(",");

  const tx = db.transaction((entryIds: readonly number[]) => {
    const updateSubmitted = db.prepare(`
            UPDATE timesheet 
            SET status = 'Complete', 
                submitted_at = datetime('now')
            WHERE id IN (${placeholders})
              AND (status IS NULL OR status = 'in_progress')
        `);

    const result = updateSubmitted.run(...entryIds);

    if (result.changes !== entryIds.length) {
      const errorMessage = `Database update mismatch: expected ${entryIds.length} rows, updated ${result.changes} rows`;
      dbLogger.error("Could not mark timesheet entries as submitted", {
        expected: entryIds.length,
        updated: result.changes,
        ids: [...entryIds],
      });
      throw new Error(errorMessage);
    }

    return result.changes;
  });

  const changes = tx(ids);
  dbLogger.audit("mark-submitted", "Entries marked as submitted", {
    count: ids.length,
    changes,
  });
  timer.done({ count: ids.length, changes });
}

/**
 * Reverts failed timesheet entries back to pending status
 */
export function removeFailedTimesheetEntries(ids: number[]) {
  if (ids.length === 0) {
    dbLogger.debug("No failed entries to revert");
    return;
  }

  const timer = dbLogger.startTimer("revert-failed-entries");
  const db = getDb();

  dbLogger.warn("Reverting failed timesheet entries back to pending", {
    count: ids.length,
    ids,
  });
  const placeholders = ids.map(() => "?").join(",");

  const tx = db.transaction((entryIds: readonly number[]) => {
    const revertFailed = db.prepare(`
            UPDATE timesheet 
            SET status = NULL
            WHERE id IN (${placeholders})
              AND status = 'in_progress'
        `);

    const result = revertFailed.run(...entryIds);

    if (result.changes !== entryIds.length) {
      const errorMessage = `Database update mismatch: expected ${entryIds.length} rows, updated ${result.changes} rows`;
      dbLogger.error("Could not revert failed timesheet entries", {
        expected: entryIds.length,
        updated: result.changes,
        ids: [...entryIds],
      });
      throw new Error(errorMessage);
    }

    return result.changes;
  });

  const changes = tx(ids);
  dbLogger.audit("revert-failed", "Failed entries reverted to pending", {
    count: ids.length,
    changes,
  });
  timer.done({ count: ids.length, changes });
}

/**
 * Resets in-progress timesheet entries to NULL
 * Used during error recovery to ensure entries aren't stuck
 */
export function resetInProgressTimesheetEntries(): number {
  const timer = dbLogger.startTimer("reset-in-progress-entries");
  const db = getDb();

  const update = db.prepare(`
        UPDATE timesheet 
        SET status = NULL
        WHERE status = 'in_progress'
    `);

  const result = update.run();
  if (result.changes > 0) {
    dbLogger.info("Reset in-progress entries to NULL", {
      count: result.changes,
    });
  }
  timer.done({ changes: result.changes });
  return result.changes;
}
