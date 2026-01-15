import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";

/**
 * Calculate total hours for a date from draft rows
 */
function calculateDraftHoursForDate(
  date: string,
  rows: TimesheetRow[],
  excludeRowIndex?: number
): number {
  let total = 0;
  rows.forEach((row, idx) => {
    if (idx === excludeRowIndex) return; // Exclude the row being edited
    if (row.date === date && row.hours !== undefined && row.hours !== null) {
      total += row.hours;
    }
  });
  return total;
}

/**
 * Convert date from MM/DD/YYYY to YYYY-MM-DD format for comparison
 */
function convertDateToISO(dateStr: string): string {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr;
  const month = parts[0];
  const day = parts[1];
  const year = parts[2];
  if (!month || !day || !year) return dateStr;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Calculate total hours for a date from submitted entries
 */
function calculateSubmittedHoursForDate(
  date: string,
  submittedEntries: Array<{ date: string; hours: number | null }>
): number {
  // Convert date from MM/DD/YYYY to YYYY-MM-DD for comparison
  const isoDate = convertDateToISO(date);

  let total = 0;
  submittedEntries.forEach((entry) => {
    if (
      entry.date === isoDate &&
      entry.hours !== undefined &&
      entry.hours !== null
    ) {
      total += entry.hours;
    }
  });
  return total;
}

export {
  calculateDraftHoursForDate,
  convertDateToISO,
  calculateSubmittedHoursForDate,
};
