import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';
import { ALLOWED_PREVIOUS_QUARTERS } from '@sheetpilot/shared';

function getQuarter(date: Date): number {
  const month = date.getMonth();
  return Math.floor(month / 3) + 1;
}

function getQuarterBounds(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0);
  
  return { start, end };
}

export function getQuarterDateRange(): { minDate: Date; maxDate: Date } {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentQuarter = getQuarter(today);
  
  const currentBounds = getQuarterBounds(currentYear, currentQuarter);
  
  const maxDate = currentBounds.end;
  
  let minDate: Date;
  
  if ((ALLOWED_PREVIOUS_QUARTERS as number) === 0) {
    minDate = currentBounds.start;
  } else {
    let targetQuarter = currentQuarter - ALLOWED_PREVIOUS_QUARTERS;
    let targetYear = currentYear;
    
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
  if (month < 1 || month > 12) return false;

  if (day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);

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
  const month = date.getMonth() + 1;
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
  
  if (validDates.length < 3) {
    return false;
  }
  
  for (const date of validDates) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
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
  
  if (!previousRow || !previousRow.date) {
    return formatDateForDisplay(today);
  }
  
  const previousDate = parseDateString(previousRow.date);
  if (!previousDate) {
    return formatDateForDisplay(today);
  }
  
  previousDate.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor((today.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > 1) {
    return formatDateForDisplay(today);
  }
  
  return previousRow.date;
}

