export interface TimesheetRow {
  id?: number;
  date?: string;
  timeIn?: string;
  timeOut?: string;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
}

// Helper function to format numeric time input (e.g., 800 -> 08:00, 1430 -> 14:30)
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

export function isValidDate(dateStr?: string): boolean {
  const d = dateStr ?? '';
  if (!d) return false;
  // Check format first
  const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  if (!dateRegex.test(d)) return false;
  // Parse the date components
  const dateParts = d.split('/');
  if (dateParts.length !== 3) return false;
  const [monthStr, dayStr, yearStr] = dateParts;
  const month = parseInt(monthStr ?? '', 10);
  const day = parseInt(dayStr ?? '', 10);
  const year = parseInt(yearStr ?? '', 10);
  
  // Basic range checks
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;
  
  // Create date object and verify it matches input
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
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

