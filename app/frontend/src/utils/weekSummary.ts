/**
 * @fileoverview Weekly Summary Utility Functions
 *
 * Provides functions for calculating week boundaries, formatting dates,
 * and generating weekly summaries from timesheet entries.
 *
 * @author SheetPilot Team
 * @version 1.0.0
 */

import {
  filterWeekEntries,
  buildProjectMap,
  convertMapToSummaries,
} from "./weekSummary.helpers";
import { getWeekBounds } from "./weekSummary.formatting";

/**
 * Submitted timesheet entry from archive
 */
interface TimesheetEntry {
  id: number;
  date: string; // YYYY-MM-DD format
  hours: number | null;
  project: string;
  tool?: string;
  detail_charge_code?: string;
  task_description: string;
  status?: string;
  submitted_at?: string;
}

/**
 * Week summary data structure
 */
export interface WeekSummary {
  /** Project name */
  project: string;
  /** Hours for each day of the week (Sunday=0, Monday=1, ..., Saturday=6) */
  days: [number, number, number, number, number, number, number];
  /** Total hours for the project across the week */
  total: number;
}

/**
 * Get a unique key for a week based on its Sunday date
 *
 * @param sunday - The Sunday date of the week
 * @returns String key in format "YYYY-MM-DD"
 */
export function getWeekKey(sunday: Date): string {
  const year = sunday.getFullYear();
  const month = String(sunday.getMonth() + 1).padStart(2, "0");
  const day = String(sunday.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalize date string to YYYY-MM-DD format
 * Handles both MM/DD/YYYY and YYYY-MM-DD formats
 *
 * @param dateStr - Date string in various formats
 * @returns Date string in YYYY-MM-DD format, or null if invalid
 */
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  const mmddyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyyMatch) {
    const month = mmddyyyyMatch[1];
    const day = mmddyyyyMatch[2];
    const year = mmddyyyyMatch[3];
    if (month && day && year) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Get all weeks that have submitted data
 *
 * @param entries - Array of all timesheet entries
 * @returns Sorted array of week keys (Sunday dates as YYYY-MM-DD strings)
 */
export function getAllWeeksWithData(entries: TimesheetEntry[]): string[] {
  if (!entries || !Array.isArray(entries)) {
    return [];
  }

  const weekSet = new Set<string>();

  // Filter to only completed entries
  // Note: Status can be "Complete" (string) or other values
  const completedEntries = entries.filter((entry) => {
    return entry.status === "Complete";
  });

  for (const entry of completedEntries) {
    // Normalize date to YYYY-MM-DD format (handles MM/DD/YYYY from database)
    const normalizedDate = normalizeDate(entry.date);
    if (!normalizedDate) continue; // Skip invalid dates

    // Parse date from normalized YYYY-MM-DD format
    const entryDate = new Date(normalizedDate + "T00:00:00");
    if (isNaN(entryDate.getTime())) continue; // Skip invalid dates

    const { sunday } = getWeekBounds(entryDate);
    const weekKey = getWeekKey(sunday);
    weekSet.add(weekKey);
  }

  // Convert to sorted array
  return Array.from(weekSet).sort();
}

/**
 * Calculate weekly summary for a given week
 *
 * @param entries - Array of all timesheet entries
 * @param weekStart - The Sunday date of the week
 * @returns Array of WeekSummary objects, one per project
 */
export function calculateWeekSummary(
  entries: TimesheetEntry[],
  weekStart: Date
): WeekSummary[] {
  if (!entries || !Array.isArray(entries)) {
    return [];
  }

  const { sunday, saturday } = getWeekBounds(weekStart);
  const weekEntries = filterWeekEntries(entries, sunday, saturday);
  const projectMap = buildProjectMap(weekEntries);
  return convertMapToSummaries(projectMap);
}

export {
  getWeekBounds,
  formatWeekRange,
  getDayName,
  formatDateShort,
  getWeekDays,
} from "./weekSummary.formatting";
