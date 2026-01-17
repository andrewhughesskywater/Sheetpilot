import { dbLogger } from "@sheetpilot/shared/logger";
import { getDb } from "./connection-manager";
import type { TimesheetBulkInsertEntry } from "./timesheet-repository.types";

/**
 * Inserts a new timesheet entry with deduplication
 */
export function insertTimesheetEntry(entry: {
  date: string;
  hours: number;
  project: string;
  tool?: string | null;
  detailChargeCode?: string | null;
  taskDescription: string;
}) {
  const timer = dbLogger.startTimer("insert-timesheet-entry");
  const db = getDb();

  dbLogger.verbose("Inserting timesheet entry", {
    date: entry.date,
    project: entry.project,
    hours: entry.hours,
  });

  const insert = db.prepare(`
        INSERT INTO timesheet
          (date, hours, project, tool, detail_charge_code, task_description)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, project, task_description) DO NOTHING
    `);

  const result = insert.run(
    entry.date,
    entry.hours,
    entry.project,
    entry.tool || null,
    entry.detailChargeCode || null,
    entry.taskDescription
  );

  if (result.changes > 0) {
    dbLogger.info("Timesheet entry inserted", {
      date: entry.date,
      project: entry.project,
    });
    timer.done({ isDuplicate: false, changes: result.changes });
    return { success: true, isDuplicate: false, changes: result.changes };
  } else {
    dbLogger.verbose("Duplicate timesheet entry skipped", {
      date: entry.date,
      project: entry.project,
    });
    timer.done({ isDuplicate: true });
    return { success: false, isDuplicate: true, changes: 0 };
  }
}

/**
 * Inserts multiple timesheet entries with deduplication in a single transaction
 */
export function insertTimesheetEntries(entries: TimesheetBulkInsertEntry[]): {
  success: boolean;
  total: number;
  inserted: number;
  duplicates: number;
  errors: number;
  errorMessage?: string;
} {
  const timer = dbLogger.startTimer("insert-timesheet-entries-bulk");
  const db = getDb();

  try {
    dbLogger.info("Starting bulk insert of timesheet entries", {
      count: entries.length,
    });

    const insert = db.prepare(`
            INSERT INTO timesheet
              (date, hours, project, tool, detail_charge_code, task_description)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, project, task_description) DO NOTHING
        `);

    const insertMany = db.transaction(
      (entriesList: TimesheetBulkInsertEntry[]) => {
        return entriesList.reduce(
          (acc, entry) => {
          const result = insert.run(
            entry.date,
            entry.hours,
            entry.project,
            entry.tool ?? null,
            entry.detailChargeCode ?? null,
            entry.taskDescription
          );
            if (result.changes > 0) {
              return { inserted: acc.inserted + 1, duplicates: acc.duplicates };
            }
            return { inserted: acc.inserted, duplicates: acc.duplicates + 1 };
          },
          { inserted: 0, duplicates: 0 }
        );
      }
    );

    const { inserted, duplicates } = insertMany(entries);

    dbLogger.info("Bulk insert completed", {
      total: entries.length,
      inserted,
      duplicates,
    });
    timer.done({ inserted, duplicates });

    return {
      success: true,
      total: entries.length,
      inserted,
      duplicates,
      errors: 0,
    };
  } catch (error: unknown) {
    dbLogger.error("Bulk insert failed", error);
    timer.done({ outcome: "error" });
    return {
      success: false,
      total: entries.length,
      inserted: 0,
      duplicates: 0,
      errors: entries.length,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
