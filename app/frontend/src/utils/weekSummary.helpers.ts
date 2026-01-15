/**
 * @fileoverview Week Summary Calculation Helpers
 *
 * Helper functions for calculating weekly summaries from timesheet entries.
 *
 * @author SheetPilot Team
 * @version 1.0.0
 */

import type { WeekSummary } from "./weekSummary";

/**
 * Submitted timesheet entry from archive
 */
interface TimesheetEntry {
  id: number;
  date: string;
  hours: number | null;
  project: string;
  tool?: string;
  detail_charge_code?: string;
  task_description: string;
  status?: string;
  submitted_at?: string;
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

  // Check if already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try to parse MM/DD/YYYY format
  const mmddyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyyMatch) {
    const month = mmddyyyyMatch[1];
    const day = mmddyyyyMatch[2];
    const year = mmddyyyyMatch[3];
    if (month && day && year) {
      const monthPadded = month.padStart(2, "0");
      const dayPadded = day.padStart(2, "0");
      return `${year}-${monthPadded}-${dayPadded}`;
    }
  }

  // Try to parse as Date object and format
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
 * Filter entries to only completed entries in the specified week
 */
export function filterWeekEntries(
  entries: TimesheetEntry[],
  sunday: Date,
  saturday: Date
): TimesheetEntry[] {
  return entries.filter((entry) => {
    if (entry.status !== "Complete") return false;

    const normalizedDate = normalizeDate(entry.date);
    if (!normalizedDate) return false;

    const entryDate = new Date(normalizedDate + "T00:00:00");
    if (isNaN(entryDate.getTime())) return false;

    return entryDate >= sunday && entryDate <= saturday;
  });
}

/**
 * Build project map from week entries
 */
export function buildProjectMap(
  weekEntries: TimesheetEntry[]
): Map<string, Map<number, number>> {
  const projectMap = new Map<string, Map<number, number>>();

  for (const entry of weekEntries) {
    const normalizedDate = normalizeDate(entry.date);
    if (!normalizedDate) continue;

    const entryDate = new Date(normalizedDate + "T00:00:00");
    if (isNaN(entryDate.getTime())) continue;

    const dayOfWeek = entryDate.getDay();
    const hours = entry.hours ?? 0;

    if (!projectMap.has(entry.project)) {
      projectMap.set(entry.project, new Map<number, number>());
    }

    const dayMap = projectMap.get(entry.project)!;
    const currentHours = dayMap.get(dayOfWeek) ?? 0;
    dayMap.set(dayOfWeek, currentHours + hours);
  }

  return projectMap;
}

/**
 * Extract days array from day map
 */
export function extractDaysArray(
  dayMap: Map<number, number>
): [number, number, number, number, number, number, number] {
  return [
    dayMap.get(0) ?? 0,
    dayMap.get(1) ?? 0,
    dayMap.get(2) ?? 0,
    dayMap.get(3) ?? 0,
    dayMap.get(4) ?? 0,
    dayMap.get(5) ?? 0,
    dayMap.get(6) ?? 0,
  ];
}

/**
 * Convert project map to WeekSummary array
 */
export function convertMapToSummaries(
  projectMap: Map<string, Map<number, number>>
): WeekSummary[] {
  const summaries: WeekSummary[] = [];

  for (const [project, dayMap] of projectMap.entries()) {
    const days = extractDaysArray(dayMap);
    const total = days.reduce((sum, hours) => sum + hours, 0);
    summaries.push({ project, days, total });
  }

  summaries.sort((a, b) => a.project.localeCompare(b.project));
  return summaries;
}
