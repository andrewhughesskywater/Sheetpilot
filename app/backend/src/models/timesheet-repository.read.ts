import { dbLogger } from "@sheetpilot/shared/logger";
import { getDb } from "./connection-manager";
import type {
  TimesheetDedupKey,
  TimesheetDbRow,
} from "./timesheet-repository.types";

/**
 * Checks if a timesheet entry would be a duplicate
 */
export function checkDuplicateEntry(entry: TimesheetDedupKey): boolean {
  const db = getDb();
  const checkDuplicate = db.prepare(`
        SELECT COUNT(*) as count 
        FROM timesheet 
        WHERE date = ? AND project = ? AND task_description = ?
    `);

  const result = checkDuplicate.get(
    entry.date,
    entry.project,
    entry.taskDescription
  ) as { count: number } | undefined;
  return (result?.count ?? 0) > 0;
}

/**
 * Gets all duplicate entries for a given date range
 */
export function getDuplicateEntries(
  startDate?: string,
  endDate?: string
): Array<{
  date: string;
  project: string;
  task_description: string;
  count: number;
}> {
  const db = getDb();
  const dateConditions = [
    startDate ? { clause: "date >= ?", value: startDate } : null,
    endDate ? { clause: "date <= ?", value: endDate } : null,
  ].filter(
    (condition): condition is { clause: string; value: string } =>
      Boolean(condition)
  );

  const conditionalSql =
    dateConditions.length > 0
      ? ` AND ${dateConditions.map((condition) => condition.clause).join(" AND ")}`
      : "";

  const query = `
        SELECT date, project, task_description, COUNT(*) as count
        FROM timesheet 
        GROUP BY date, project, task_description
        HAVING COUNT(*) > 1${conditionalSql}
        ORDER BY date
    `;

  const params = dateConditions.map((condition) => condition.value);
  const getDuplicates = db.prepare(query);
  return getDuplicates.all(...params) as Array<{
    date: string;
    project: string;
    task_description: string;
    count: number;
  }>;
}

/**
 * Gets all pending timesheet entries
 */
export function getPendingTimesheetEntries(): TimesheetDbRow[] {
  const timer = dbLogger.startTimer("get-pending-entries");
  const db = getDb();

  dbLogger.verbose("Fetching pending timesheet entries");
  const getPending = db.prepare(`
        SELECT * FROM timesheet 
        WHERE status IS NULL
        ORDER BY date, hours
    `);

  const entries = getPending.all() as TimesheetDbRow[];
  dbLogger.verbose("Pending entries retrieved", { count: entries.length });
  timer.done({ count: entries.length });
  return entries;
}

/**
 * Gets timesheet entries by IDs
 */
export function getTimesheetEntriesByIds(ids: number[]): TimesheetDbRow[] {
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const stmt = db.prepare(`
        SELECT * FROM timesheet 
        WHERE id IN (${placeholders})
    `);
  return stmt.all(...ids) as TimesheetDbRow[];
}

/**
 * Gets submitted timesheet entries for export
 */
export function getSubmittedTimesheetEntriesForExport() {
  const db = getDb();
  const stmt = db.prepare(`
        SELECT * FROM timesheet 
        WHERE status = 'Complete'
        ORDER BY date, project
    `);
  return stmt.all() as TimesheetDbRow[];
}

/**
 * Gets total hours for a date (including submitted entries)
 */
export function getTotalHoursForDate(date: string): number {
  const db = getDb();
  const stmt = db.prepare(`
        SELECT COALESCE(SUM(hours), 0) as total
        FROM timesheet
        WHERE date = ? AND hours IS NOT NULL
    `);
  const result = stmt.get(date) as { total: number } | undefined;
  return result?.total ?? 0;
}
