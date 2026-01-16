import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';
import { ALLOWED_PREVIOUS_QUARTERS } from '@sheetpilot/shared';

function getQuarter(date: Date): number {
  const month = date.getMonth(); // 0-11
  return Math.floor(month / 3) + 1; // 1-4
}

function getQuarterBounds(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0); // Last day of the quarter's last month
  
  return { start, end };
}

export function getQuarterDateRange(): { minDate: Date; maxDate: Date } {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentQuarter = getQuarter(today);
  
  // Current quarter bounds
  const currentBounds = getQuarterBounds(currentYear, currentQuarter);
  
  // Max date is end of current quarter
  const maxDate = currentBounds.end;
  
  // Min date depends on ALLOWED_PREVIOUS_QUARTERS
  let minDate: Date;
  
  if ((ALLOWED_PREVIOUS_QUARTERS as number) === 0) {
    // Only current quarter
    minDate = currentBounds.start;
  } else {
    // Current + previous quarter(s)
    let targetQuarter = currentQuarter - ALLOWED_PREVIOUS_QUARTERS;
    let targetYear = currentYear;
    
    // Handle year rollover
    while (targetQuarter < 1) {
      targetQuarter += 4;
      targetYear -= 1;
    }
    
    const previousBounds = getQuarterBounds(targetYear, targetQuarter);
    minDate = previousBounds.start;
  }
  
  return { minDate, maxDate };
}

export function isDateInAllowedRange(dateStr: string): boolean {
  if (!dateStr) return false;
  
  const date = parseDateString(dateStr);
  if (!date) return false;
  
  const { minDate, maxDate } = getQuarterDateRange();
  
  // Reset time components for accurate comparison
  date.setHours(0, 0, 0, 0);
  minDate.setHours(0, 0, 0, 0);
  maxDate.setHours(23, 59, 59, 999);
  
  return date >= minDate && date <= maxDate;
}

type DateParts = {
  month: number;
  day: number;
  year: number;
};

const parseDateParts = (parts: string[]): DateParts | null => {
  if (parts.length !== 3) {
    return null;
  }
  const [monthPart, dayPart, yearPart] = parts;
  const month = parseInt(monthPart || '', 10);
  const day = parseInt(dayPart || '', 10);
  const year = parseInt(yearPart || '', 10);

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

  return { month, day, year };
};

const parseDateSegments = (dateStr: string): DateParts | null => {
  if (!dateStr) return null;
  return parseDateParts(dateStr.split('/'));
};

const isValidDateParts = ({ month, day, year }: DateParts): boolean => {
  // Validate month range (1-12)
  if (month < 1 || month > 12) return false;

  // Validate day range (1-31)
  if (day < 1 || day > 31) return false;

  // Month is 0-indexed in Date constructor
  const date = new Date(year, month - 1, day);

  // Validate that the date components didn't overflow (e.g., Feb 30 becomes Mar 2)
  return (
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getFullYear() === year
  );
};

export function parseDateString(dateStr: string): Date | null {
  const parts = parseDateSegments(dateStr);
  if (!parts || !isValidDateParts(parts)) {
    return null;
  }
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function formatDateForDisplay(date: Date): string {
  const month = date.getMonth() + 1; // 0-indexed to 1-indexed
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${month}/${day}/${year}`;
}

export function incrementDate(dateStr: string, days: number, skipWeekends = false): string {
  const date = parseDateString(dateStr);
  if (!date) return '';
  
  const currentDate = new Date(date);
  let daysToAdd = Math.abs(days);
  const direction = days > 0 ? 1 : -1;
  
  while (daysToAdd > 0) {
    currentDate.setDate(currentDate.getDate() + direction);
    
    if (skipWeekends) {
      const dayOfWeek = currentDate.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysToAdd--;
      }
    } else {
      daysToAdd--;
    }
  }
  
  return formatDateForDisplay(currentDate);
}

export function detectWeekdayPattern(rows: TimesheetRow[]): boolean {
  const validDates: Date[] = [];
  
  for (const row of rows) {
    if (row.date) {
      const date = parseDateString(row.date);
      if (date) {
        validDates.push(date);
      }
    }
  }
  
  // Need at least 3 dates to detect a pattern
  if (validDates.length < 3) {
    return false;
  }
  
  // Check if all dates are weekdays
  for (const date of validDates) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Found a weekend day
      return false;
    }
  }
  
  return true;
}

export function getSmartPlaceholder(
  previousRow: TimesheetRow | undefined,
  _allRows: TimesheetRow[],
  _skipWeekends: boolean
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // No previous row → suggest today
  if (!previousRow || !previousRow.date) {
    return formatDateForDisplay(today);
  }
  
  const previousDate = parseDateString(previousRow.date);
  if (!previousDate) {
    return formatDateForDisplay(today);
  }
  
  previousDate.setHours(0, 0, 0, 0);
  
  // Calculate days between previous entry and today
  const daysDiff = Math.floor((today.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Previous row is more than 1 day old → suggest today
  if (daysDiff > 1) {
    return formatDateForDisplay(today);
  }
  
  // Previous row is recent (≤1 day)
  // Suggest same date as previous row
  return previousRow.date;
}

