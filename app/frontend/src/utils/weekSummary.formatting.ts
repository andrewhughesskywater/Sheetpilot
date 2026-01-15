/**
 * @fileoverview Week Summary Formatting Utilities
 *
 * Formatting functions for weekly summary display.
 *
 * @author SheetPilot Team
 * @version 1.0.0
 */

/**
 * Get the Sunday and Saturday dates for the week containing the given date
 * Week starts on Sunday (day 0) and ends on Saturday (day 6)
 *
 * @param date - Any date within the week
 * @returns Object with sunday and saturday Date objects
 */
export function getWeekBounds(date: Date): { sunday: Date; saturday: Date } {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

  // Calculate Sunday by subtracting the day of week
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - dayOfWeek);
  sunday.setHours(0, 0, 0, 0);

  // Calculate Saturday by adding (6 - dayOfWeek) days
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  return { sunday, saturday };
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Format week range for display
 *
 * @param sunday - The Sunday date of the week
 * @param saturday - The Saturday date of the week
 * @returns Formatted string like "Jan 5 - Jan 11, 2025"
 */
export function formatWeekRange(sunday: Date, saturday: Date): string {
  const sunMonth = MONTH_NAMES[sunday.getMonth()];
  const sunDay = sunday.getDate();
  const sunYear = sunday.getFullYear();
  const satMonth = MONTH_NAMES[saturday.getMonth()];
  const satDay = saturday.getDate();
  const satYear = saturday.getFullYear();

  if (sunMonth === satMonth && sunYear === satYear) {
    return `${sunMonth} ${sunDay} - ${satDay}, ${sunYear}`;
  }
  if (sunYear === satYear) {
    return `${sunMonth} ${sunDay} - ${satMonth} ${satDay}, ${sunYear}`;
  }
  return `${sunMonth} ${sunDay}, ${sunYear} - ${satMonth} ${satDay}, ${satYear}`;
}

/**
 * Get abbreviated day name
 *
 * @param date - Date object
 * @returns Abbreviated day name (e.g., "Sun", "Mon", "Tue")
 */
export function getDayName(date: Date): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return dayNames[date.getDay()];
}

/**
 * Format date in short format
 *
 * @param date - Date object
 * @returns Short date string (e.g., "1/5", "12/31")
 */
export function formatDateShort(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

/**
 * Get all 7 days of the week starting from Sunday
 *
 * @param weekStart - The Sunday date of the week
 * @returns Array of 7 Date objects (Sunday through Saturday)
 */
export function getWeekDays(weekStart: Date): Date[] {
  const { sunday } = getWeekBounds(weekStart);
  const days: Date[] = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    days.push(day);
  }

  return days;
}
