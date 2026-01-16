/**
 * Timesheet row data structure
 * 
 * Represents a single time entry in the editable grid.
 * All fields are optional to support partial data entry during editing.
 * 
 * Data format notes:
 * - date: MM/DD/YYYY format (validates both MM/DD/YYYY and YYYY-MM-DD, normalizes to MM/DD/YYYY)
 * - hours: Decimal values in 15-minute increments (0.25 = 15 min, 0.5 = 30 min, 1.0 = 1 hour, etc.)
 *   Range: 0.25 to 24.0 hours
 * - tool/chargeCode: null when not applicable based on business rules
 */
export interface TimesheetRow {
  /** Database ID (assigned after first save) */
  id?: number;
  /** Date in MM/DD/YYYY format */
  date?: string;
  /** Hours worked as decimal (15-minute increments: 0.25, 0.5, 0.75, 1.0, etc.) */
  hours?: number;
  /** Project name from PROJECTS config */
  project?: string;
  /** Tool name (null if project doesn't require tools) */
  tool?: string | null;
  /** Charge code (null if tool doesn't require charge code) */
  chargeCode?: string | null;
  /** Task description text (max 120 characters for SmartSheet) */
  taskDescription?: string;
}

type DateParts = {
  month: number;
  day: number;
  year: number;
};

const US_DATE_REGEX = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{1,2}-\d{1,2}$/;

function parseDateParts(dateStr: string): DateParts | null {
  if (US_DATE_REGEX.test(dateStr)) {
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return null;
    const [monthStr, dayStr, yearStr] = dateParts;
    return {
      month: parseInt(monthStr ?? '', 10),
      day: parseInt(dayStr ?? '', 10),
      year: parseInt(yearStr ?? '', 10)
    };
  }

  if (ISO_DATE_REGEX.test(dateStr)) {
    const dateParts = dateStr.split('-');
    if (dateParts.length !== 3) return null;
    const [yearStr, monthStr, dayStr] = dateParts;
    return {
      month: parseInt(monthStr ?? '', 10),
      day: parseInt(dayStr ?? '', 10),
      year: parseInt(yearStr ?? '', 10)
    };
  }

  return null;
}

function isValidDateParts({ month, day, year }: DateParts): boolean {
  // Basic range checks
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;

  // Create date object and verify it matches input
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Normalize date to MM/DD/YYYY format
 * Accepts both MM/DD/YYYY and YYYY-MM-DD formats
 */
export function normalizeDateFormat(dateStr?: string): string {
  const d = dateStr ?? '';
  if (!d) return '';
  
  // Check if already in MM/DD/YYYY format
  if (US_DATE_REGEX.test(d)) {
    return d; // Already in correct format
  }
  
  // Check for YYYY-MM-DD format (ISO format, dash-separated)
  if (ISO_DATE_REGEX.test(d)) {
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

export function isValidDate(dateStr?: string): boolean {
  const d = dateStr ?? '';
  if (!d) return false;

  const dateParts = parseDateParts(d);
  if (!dateParts) return false;

  return isValidDateParts(dateParts);
}

/**
 * Check if hours value is valid
 * 
 * Validates that hours is:
 * - A number
 * - In 15-minute increments (multiple of 0.25)
 * - Within range: 0.25 to 24.0 hours
 * 
 * @param hours - Hours value to validate
 * @returns true if valid, false otherwise
 */
export function isValidHours(hours?: number | null): boolean {
  if (hours === undefined || hours === null) return false;
  if (typeof hours !== 'number' || isNaN(hours)) return false;
  
  // Check if it's a multiple of 0.25 (15-minute increments)
  // Use modulo with tolerance for floating point precision
  const remainder = (hours * 4) % 1;
  if (Math.abs(remainder) > 0.0001 && Math.abs(remainder - 1) > 0.0001) {
    return false;
  }
  
  // Check range: 0.25 to 24.0
  return hours >= 0.25 && hours <= 24.0;
}

export function normalizeRowData(row: TimesheetRow, projectNeedsTools: (p?: string) => boolean, toolNeedsChargeCode: (t?: string) => boolean): TimesheetRow {
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

