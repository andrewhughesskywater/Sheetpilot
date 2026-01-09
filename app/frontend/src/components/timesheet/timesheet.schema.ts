/**
 * Timesheet row data structure
 *
 * Represents a single time entry in the editable grid.
 * All fields are optional to support partial data entry during editing.
 *
 * Data format notes:
 * - date: MM/DD/YYYY format (validates both MM/DD/YYYY and YYYY-MM-DD, normalizes to MM/DD/YYYY)
 * - timeIn/timeOut: HH:MM 24-hour format (validates 15-minute increments)
 * - tool/chargeCode: null when not applicable based on business rules
 */
export interface TimesheetRow {
  /** Database ID (assigned after first save) */
  id?: number;
  /** Date in MM/DD/YYYY format */
  date?: string;
  /** Start time in HH:MM format (24-hour, 15-min increments) */
  timeIn?: string;
  /** End time in HH:MM format (24-hour, 15-min increments) */
  timeOut?: string;
  /** Project name from PROJECTS config */
  project?: string;
  /** Tool name (null if project doesn't require tools) */
  tool?: string | null;
  /** Charge code (null if tool doesn't require charge code) */
  chargeCode?: string | null;
  /** Task description text (max 120 characters for SmartSheet) */
  taskDescription?: string;
}

/**
 * Format various time input formats to HH:MM
 *
 * Accepts flexible time entry formats for better UX:
 * - "8" or "08" → "08:00"
 * - "800" → "08:00"
 * - "1430" → "14:30"
 * - "08:30" → "08:30" (already formatted)
 *
 * @param timeStr - Time string in various formats
 * @returns Formatted time string in HH:MM format
 */
export function formatTimeInput(timeStr: unknown): string {
  if (typeof timeStr !== 'string') return String(timeStr || '');
  // Remove any non-numeric characters
  const numericOnly = timeStr.replace(/\D/g, '');

  // Handle different input formats
  if (numericOnly.length === 3) {
    // 800 -> 08:00
    const hours = numericOnly.substring(0, 1);
    const minutes = numericOnly.substring(1, 3);
    return `${hours.padStart(2, '0')}:${minutes}`;
  } else if (numericOnly.length === 4) {
    // 1430 -> 14:30
    const hours = numericOnly.substring(0, 2);
    const minutes = numericOnly.substring(2, 4);
    return `${hours}:${minutes}`;
  } else if (numericOnly.length === 2) {
    // 08 -> 08:00
    return `${numericOnly}:00`;
  } else if (numericOnly.length === 1) {
    // 8 -> 08:00
    return `${numericOnly.padStart(2, '0')}:00`;
  }

  // Return original if it doesn't match expected patterns
  return timeStr;
}

/**
 * Normalize date to MM/DD/YYYY format
 * Accepts both MM/DD/YYYY and YYYY-MM-DD formats
 */
export function normalizeDateFormat(dateStr?: string): string {
  const d = dateStr ?? '';
  if (!d) return '';

  // Check if already in MM/DD/YYYY format
  const usFormatRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  if (usFormatRegex.test(d)) {
    return d; // Already in correct format
  }

  // Check for YYYY-MM-DD format (ISO format, dash-separated)
  const isoFormatRegex = /^\d{4}-\d{1,2}-\d{1,2}$/;
  if (isoFormatRegex.test(d)) {
    const dateParts = d.split('-');
    if (dateParts.length !== 3) return d;
    const [yearStr, monthStr, dayStr] = dateParts;
    const month = parseInt(monthStr ?? '', 10);
    const day = parseInt(dayStr ?? '', 10);
    const year = parseInt(yearStr ?? '', 10);

    // Convert to MM/DD/YYYY
    return `${month}/${day}/${year}`;
  }

  // Return original if format not recognized
  return d;
}

/**
 * Parse a date string into year, month, and day parts.
 * Supports MM/DD/YYYY and YYYY-MM-DD formats.
 */
function parseDateParts(dateStr?: string): { year: number; month: number; day: number } | null {
  const d = dateStr ?? '';
  if (!d) return null;

  // MM/DD/YYYY or M/D/YYYY
  const usFormatRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  if (usFormatRegex.test(d)) {
    const [monthStr, dayStr, yearStr] = d.split('/');
    const month = parseInt(monthStr ?? '', 10);
    const day = parseInt(dayStr ?? '', 10);
    const year = parseInt(yearStr ?? '', 10);
    return { year, month, day };
  }

  // YYYY-MM-DD
  const isoFormatRegex = /^\d{4}-\d{1,2}-\d{1,2}$/;
  if (isoFormatRegex.test(d)) {
    const [yearStr, monthStr, dayStr] = d.split('-');
    const year = parseInt(yearStr ?? '', 10);
    const month = parseInt(monthStr ?? '', 10);
    const day = parseInt(dayStr ?? '', 10);
    return { year, month, day };
  }

  return null;
}

/**
 * Validate parsed date parts are within acceptable ranges and represent a real date.
 */
function isValidDateParts(parts: { year: number; month: number; day: number } | null): boolean {
  if (!parts) return false;
  const { year, month, day } = parts;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function isValidDate(dateStr?: string): boolean {
  return isValidDateParts(parseDateParts(dateStr));
}

export function isValidTime(timeStr?: string): boolean {
  if (!timeStr) return false;
  // First try to format the input
  const formattedTime = formatTimeInput(timeStr);
  // Check if it matches HH:MM format
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(formattedTime)) return false;
  const parts = formattedTime.split(':');
  if (parts.length !== 2) return false;
  const [hours, minutes] = parts.map(Number) as [number, number];
  const totalMinutes = hours * 60 + minutes;
  // Check if it's a multiple of 15 minutes
  return totalMinutes % 15 === 0;
}

export function isTimeOutAfterTimeIn(timeIn?: string, timeOut?: string): boolean {
  if (!timeIn || !timeOut) return true; // Let other validations handle missing values
  if (!isValidTime(timeIn) || !isValidTime(timeOut)) return true;
  const [inHours, inMinutes] = timeIn.split(':').map(Number) as [number, number];
  const [outHours, outMinutes] = timeOut.split(':').map(Number) as [number, number];
  const inTotalMinutes = inHours * 60 + inMinutes;
  const outTotalMinutes = outHours * 60 + outMinutes;
  return outTotalMinutes > inTotalMinutes;
}

/**
 * Check if two time ranges overlap (excluding adjacent boundaries)
 * Returns true if the ranges overlap, false otherwise
 */
export function timeRangesOverlap(timeIn1: string, timeOut1: string, timeIn2: string, timeOut2: string): boolean {
  const [in1Hours, in1Minutes] = timeIn1.split(':').map(Number) as [number, number];
  const [out1Hours, out1Minutes] = timeOut1.split(':').map(Number) as [number, number];
  const [in2Hours, in2Minutes] = timeIn2.split(':').map(Number) as [number, number];
  const [out2Hours, out2Minutes] = timeOut2.split(':').map(Number) as [number, number];

  const in1Total = in1Hours * 60 + in1Minutes;
  const out1Total = out1Hours * 60 + out1Minutes;
  const in2Total = in2Hours * 60 + in2Minutes;
  const out2Total = out2Hours * 60 + out2Minutes;

  // Ranges overlap if: start1 < end2 AND end1 > start2
  // Using strict inequalities to allow adjacent times (e.g., 12:00-15:00 and 15:00-17:00)
  return in1Total < out2Total && out1Total > in2Total;
}

/**
 * Check if a row's time range overlaps with any previous rows on the same date
 * Returns true if there's an overlap, false otherwise
 */
function isRowCompleteValid(
  row?: TimesheetRow
): row is Required<Pick<TimesheetRow, 'date' | 'timeIn' | 'timeOut'>> & TimesheetRow {
  if (!row) return false;
  const { date, timeIn, timeOut } = row;
  if (!date || !timeIn || !timeOut) return false;
  if (!isValidDate(date) || !isValidTime(timeIn) || !isValidTime(timeOut)) return false;
  return isTimeOutAfterTimeIn(timeIn, timeOut);
}

export function hasTimeOverlapWithPreviousEntries(currentRowIndex: number, rows: TimesheetRow[]): boolean {
  const currentRow = rows[currentRowIndex];
  if (!isRowCompleteValid(currentRow)) return false;

  // Only consider previous rows with the same date and valid complete entries
  const sameDateValidPrevious = rows
    .slice(0, currentRowIndex)
    .filter((r) => isRowCompleteValid(r) && r!.date === currentRow.date);

  for (const prev of sameDateValidPrevious) {
    if (timeRangesOverlap(currentRow.timeIn!, currentRow.timeOut!, prev.timeIn!, prev.timeOut!)) {
      return true;
    }
  }
  return false;
}

export function normalizeRowData(
  row: TimesheetRow,
  projectNeedsTools: (p?: string) => boolean,
  toolNeedsChargeCode: (t?: string) => boolean
): TimesheetRow {
  const normalized = { ...row };
  if (!projectNeedsTools(normalized.project)) {
    normalized.tool = null;
    normalized.chargeCode = null;
  }
  if (!toolNeedsChargeCode(normalized.tool || undefined)) {
    normalized.chargeCode = null;
  }
  return normalized;
}
