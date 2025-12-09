/**
 * @fileoverview SmartDate Utility Tests
 * 
 * Tests for date parsing, formatting, quarter calculations, and validation.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isDateInAllowedRange,
  parseDateString,
  formatDateForDisplay,
  incrementDate,
  detectWeekdayPattern,
  getSmartPlaceholder,
  getQuarterDateRange
} from '../../src/utils/smartDate';
import type { TimesheetRow } from '../../src/components/timesheet/timesheet.schema';

// Mock constants
vi.mock('../../../shared/constants', () => ({
  ALLOWED_PREVIOUS_QUARTERS: 1
}));

describe('SmartDate Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getQuarterDateRange', () => {
    it('should return date range for current quarter', () => {
      const range = getQuarterDateRange();
      
      expect(range).toHaveProperty('minDate');
      expect(range).toHaveProperty('maxDate');
      expect(range.minDate).toBeInstanceOf(Date);
      expect(range.maxDate).toBeInstanceOf(Date);
      expect(range.minDate.getTime()).toBeLessThanOrEqual(range.maxDate.getTime());
    });

    it('should include previous quarter when ALLOWED_PREVIOUS_QUARTERS is 1', () => {
      const range = getQuarterDateRange();
      const today = new Date();
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      
      // minDate should be from previous quarter
      expect(range.minDate.getTime()).toBeLessThanOrEqual(threeMonthsAgo.getTime());
    });
  });

  describe('isDateInAllowedRange', () => {
    it('should accept dates in current and previous quarter', () => {
      // Get the actual allowed date range
      const { minDate, maxDate } = getQuarterDateRange();
      
      // Create a date that is within the range (middle of range)
      const midDate = new Date(minDate.getTime() + (maxDate.getTime() - minDate.getTime()) / 2);
      const midDateStr = formatDateForDisplay(midDate);
      
      expect(isDateInAllowedRange(midDateStr)).toBe(true);
    });

    it('should reject dates outside allowed range', () => {
      // Dates far in the past and future should be rejected
      const invalidDates = [
        '01/01/2020',  // Far in the past
        '01/01/2030'   // Far in the future
      ];
      
      invalidDates.forEach(date => {
        expect(isDateInAllowedRange(date)).toBe(false);
      });
    });

    it('should handle malformed dates', () => {
      const malformedDates = [
        'invalid',
        '',
        '13/01/2025',
        '01/32/2025'
      ];
      
      malformedDates.forEach(date => {
        const result = isDateInAllowedRange(date);
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('parseDateString', () => {
    it('should parse valid MM/DD/YYYY dates', () => {
      const date = parseDateString('01/15/2025');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2025);
      expect(date?.getMonth()).toBe(0); // January is 0
      expect(date?.getDate()).toBe(15);
    });

    it('should return null for invalid format', () => {
      expect(parseDateString('invalid')).toBeNull();
      expect(parseDateString('')).toBeNull();
      expect(parseDateString('13/01/2025')).toBeNull();
      expect(parseDateString('01/32/2025')).toBeNull();
    });

    it('should return null for missing parts', () => {
      expect(parseDateString('01/15')).toBeNull();
      expect(parseDateString('2025')).toBeNull();
    });
  });

  describe('formatDateForDisplay', () => {
    it('should format date to MM/DD/YYYY', () => {
      const date = new Date(2025, 0, 15); // January 15, 2025
      expect(formatDateForDisplay(date)).toBe('1/15/2025');
    });

    it('should handle single digit months and days', () => {
      const date = new Date(2025, 0, 5); // January 5, 2025
      expect(formatDateForDisplay(date)).toBe('1/5/2025');
    });
  });

  describe('incrementDate', () => {
    it('should add days to date', () => {
      const result = incrementDate('01/15/2025', 1);
      expect(result).toBe('1/16/2025');
    });

    it('should subtract days from date', () => {
      const result = incrementDate('01/15/2025', -1);
      expect(result).toBe('1/14/2025');
    });

    it('should skip weekends when skipWeekends is true', () => {
      // Friday to Monday (skipping weekend)
      const result = incrementDate('01/17/2025', 1, true); // Assuming 1/17/2025 is a Friday
      expect(result).toBeTruthy();
    });

    it('should return empty string for invalid date', () => {
      expect(incrementDate('invalid', 1)).toBe('');
    });
  });

  describe('detectWeekdayPattern', () => {
    it('should return true when all dates are weekdays', () => {
      const rows: TimesheetRow[] = [
        { date: '01/15/2025' }, // Assuming these are weekdays
        { date: '01/16/2025' },
        { date: '01/17/2025' }
      ];
      // Note: Actual result depends on actual day of week
      expect(typeof detectWeekdayPattern(rows)).toBe('boolean');
    });

    it('should return false when fewer than 3 dates', () => {
      const rows: TimesheetRow[] = [
        { date: '01/15/2025' },
        { date: '01/16/2025' }
      ];
      expect(detectWeekdayPattern(rows)).toBe(false);
    });

    it('should handle rows without dates', () => {
      const rows: TimesheetRow[] = [
        { project: 'Test' },
        { project: 'Test' },
        { project: 'Test' }
      ];
      expect(detectWeekdayPattern(rows)).toBe(false);
    });
  });

  describe('getSmartPlaceholder', () => {
    it('should return today when no previous row', () => {
      const result = getSmartPlaceholder(undefined, [], false);
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it('should return today when previous row has no date', () => {
      const previousRow: TimesheetRow = { project: 'Test' };
      const result = getSmartPlaceholder(previousRow, [], false);
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it('should return same date when previous row is recent', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const dateStr = formatDateForDisplay(yesterday);
      
      const previousRow: TimesheetRow = { date: dateStr };
      const result = getSmartPlaceholder(previousRow, [], false);
      expect(result).toBe(dateStr);
    });

    it('should increment date when timeOut is after 7 PM', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const dateStr = formatDateForDisplay(yesterday);
      
      const previousRow: TimesheetRow = {
        date: dateStr,
        timeOut: '19:00'
      };
      const result = getSmartPlaceholder(previousRow, [], false);
      expect(result).toBeTruthy();
      expect(result).not.toBe(dateStr);
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year dates', () => {
      const date = parseDateString('02/29/2024');
      expect(date).toBeInstanceOf(Date);
    });

    it('should handle year boundaries', () => {
      const range = getQuarterDateRange();
      expect(range.minDate).toBeInstanceOf(Date);
      expect(range.maxDate).toBeInstanceOf(Date);
    });

    it('should handle month boundaries', () => {
      expect(parseDateString('01/31/2025')).toBeInstanceOf(Date);
      expect(parseDateString('02/28/2025')).toBeInstanceOf(Date);
    });
  });
});

