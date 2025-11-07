/**
 * @fileoverview SmartDate Utility Tests
 * 
 * Tests for date parsing, formatting, quarter calculations, and validation.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import { isDateInAllowedRange, getQuarterFromDate, formatDateToISO, parseUSDate } from '../../../src/utils/smartDate';

describe('SmartDate Utility', () => {
  describe('isDateInAllowedRange', () => {
    it('should accept dates in allowed quarters (2025)', () => {
      const validDates = [
        '01/01/2025',  // Q1
        '03/31/2025',  // Q1
        '04/01/2025',  // Q2
        '06/30/2025',  // Q2
        '07/01/2025',  // Q3
        '09/30/2025',  // Q3
        '10/01/2025',  // Q4
        '12/31/2025'   // Q4
      ];
      
      validDates.forEach(date => {
        expect(isDateInAllowedRange(date)).toBe(true);
      });
    });

    it('should reject dates outside allowed range', () => {
      const invalidDates = [
        '12/31/2024',  // Before range
        '01/01/2026'   // After range
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

  describe('getQuarterFromDate', () => {
    it('should calculate Q1 correctly', () => {
      const q1Dates = ['01/15/2025', '02/15/2025', '03/15/2025'];
      
      q1Dates.forEach(date => {
        const quarter = getQuarterFromDate(date);
        expect(quarter).toBe(1);
      });
    });

    it('should calculate Q2 correctly', () => {
      const q2Dates = ['04/15/2025', '05/15/2025', '06/15/2025'];
      
      q2Dates.forEach(date => {
        const quarter = getQuarterFromDate(date);
        expect(quarter).toBe(2);
      });
    });

    it('should calculate Q3 correctly', () => {
      const q3Dates = ['07/15/2025', '08/15/2025', '09/15/2025'];
      
      q3Dates.forEach(date => {
        const quarter = getQuarterFromDate(date);
        expect(quarter).toBe(3);
      });
    });

    it('should calculate Q4 correctly', () => {
      const q4Dates = ['10/15/2025', '11/15/2025', '12/15/2025'];
      
      q4Dates.forEach(date => {
        const quarter = getQuarterFromDate(date);
        expect(quarter).toBe(4);
      });
    });

    it('should handle quarter boundary dates', () => {
      expect(getQuarterFromDate('03/31/2025')).toBe(1); // Last day of Q1
      expect(getQuarterFromDate('04/01/2025')).toBe(2); // First day of Q2
      expect(getQuarterFromDate('06/30/2025')).toBe(2); // Last day of Q2
      expect(getQuarterFromDate('07/01/2025')).toBe(3); // First day of Q3
      expect(getQuarterFromDate('09/30/2025')).toBe(3); // Last day of Q3
      expect(getQuarterFromDate('10/01/2025')).toBe(4); // First day of Q4
    });
  });

  describe('formatDateToISO', () => {
    it('should convert mm/dd/yyyy to yyyy-mm-dd', () => {
      const tests = [
        { input: '01/15/2025', expected: '2025-01-15' },
        { input: '12/31/2024', expected: '2024-12-31' },
        { input: '6/5/2025', expected: '2025-06-05' },  // Single digits
        { input: '1/1/2025', expected: '2025-01-01' }
      ];
      
      tests.forEach(({ input, expected }) => {
        const result = formatDateToISO(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDates = ['invalid', '', '13/01/2025', 'not-a-date'];
      
      invalidDates.forEach(date => {
        const result = formatDateToISO(date);
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('parseUSDate', () => {
    it('should parse valid US format dates', () => {
      const tests = [
        { input: '01/15/2025', expectedMonth: 1, expectedDay: 15, expectedYear: 2025 },
        { input: '12/31/2024', expectedMonth: 12, expectedDay: 31, expectedYear: 2024 },
        { input: '6/5/2025', expectedMonth: 6, expectedDay: 5, expectedYear: 2025 }
      ];
      
      tests.forEach(({ input, expectedMonth, expectedDay, expectedYear }) => {
        const [month, day, year] = parseUSDate(input);
        expect(month).toBe(expectedMonth);
        expect(day).toBe(expectedDay);
        expect(year).toBe(expectedYear);
      });
    });

    it('should handle invalid format', () => {
      const result = parseUSDate('invalid');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year dates', () => {
      expect(isDateInAllowedRange('02/29/2024')).toBe(false); // 2024 outside range
      expect(getQuarterFromDate('02/29/2024')).toBe(1); // Q1
    });

    it('should handle year boundaries', () => {
      expect(isDateInAllowedRange('12/31/2025')).toBe(true);
      expect(isDateInAllowedRange('01/01/2025')).toBe(true);
    });

    it('should handle quarter boundaries precisely', () => {
      const boundaries = [
        { date: '03/31/2025', quarter: 1 },
        { date: '04/01/2025', quarter: 2 },
        { date: '06/30/2025', quarter: 2 },
        { date: '07/01/2025', quarter: 3 },
        { date: '09/30/2025', quarter: 3 },
        { date: '10/01/2025', quarter: 4 }
      ];
      
      boundaries.forEach(({ date, quarter }) => {
        expect(getQuarterFromDate(date)).toBe(quarter);
      });
    });
  });
});

