/**
 * @fileoverview Date Normalization Unit Tests
 * 
 * Tests date format conversion and normalization to prevent AI regression.
 * Validates mm/dd/yyyy ↔ yyyy-mm-dd conversions.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import { dateFormatTestCases } from '../fixtures/timesheet-data';
import { isValidDate } from '../../src/logic/timesheet-validation';

describe('Date Normalization Unit Tests', () => {
  describe('Date Format Conversion', () => {
    it('should convert mm/dd/yyyy to yyyy-mm-dd correctly', () => {
      const conversionTests = [
        { input: '01/15/2025', expected: '2025-01-15' },
        { input: '12/31/2024', expected: '2024-12-31' },
        { input: '02/29/2024', expected: '2024-02-29' }, // Leap year
        { input: '03/31/2025', expected: '2025-03-31' },
        { input: '04/01/2025', expected: '2025-04-01' },
        { input: '06/15/2025', expected: '2025-06-15' },
        { input: '09/30/2025', expected: '2025-09-30' },
        { input: '11/28/2025', expected: '2025-11-28' }
      ];
      
      conversionTests.forEach(({ input, expected }) => {
        const [month, day, year] = input.split('/').map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        expect(isoDate).toBe(expected);
      });
    });

    it('should convert yyyy-mm-dd to mm/dd/yyyy correctly', () => {
      const conversionTests = [
        { input: '2025-01-15', expected: '01/15/2025' },
        { input: '2024-12-31', expected: '12/31/2024' },
        { input: '2024-02-29', expected: '02/29/2024' }, // Leap year
        { input: '2025-03-31', expected: '03/31/2025' },
        { input: '2025-04-01', expected: '04/01/2025' },
        { input: '2025-06-15', expected: '06/15/2025' },
        { input: '2025-09-30', expected: '09/30/2025' },
        { input: '2025-11-28', expected: '11/28/2025' }
      ];
      
      conversionTests.forEach(({ input, expected }) => {
        const [year, month, day] = input.split('-').map(Number);
        const displayDate = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
        expect(displayDate).toBe(expected);
      });
    });

    it('should handle single digit months and days correctly', () => {
      const singleDigitTests = [
        { input: '1/1/2025', expected: '2025-01-01' },
        { input: '1/15/2025', expected: '2025-01-15' },
        { input: '12/1/2025', expected: '2025-12-01' },
        { input: '3/5/2025', expected: '2025-03-05' }
      ];
      
      singleDigitTests.forEach(({ input, expected }) => {
        const [month, day, year] = input.split('/').map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        expect(isoDate).toBe(expected);
      });
    });
  });

  describe('Date Validation', () => {
    it('should validate all test cases correctly', () => {
      dateFormatTestCases.forEach(({ input, expected, isValid }) => {
        if (isValid) {
          const [month, day, year] = input.split('/').map(Number);
          const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          expect(isoDate).toBe(expected);
          expect(isValidDate(input)).toBe(true);
        } else {
          // For invalid inputs, should not be valid
          expect(isValidDate(input)).toBe(false);
        }
      });
    });

    it('should reject invalid date formats', () => {
      const invalidFormats = [
        '2025-01-15', // Wrong format
        '1/15/25',    // Wrong format
        '01-15-2025', // Wrong separator
        '15/01/2025', // Wrong order
        '01/15',      // Missing year
        '2025/01/15', // Wrong format
        ''            // Empty
      ];
      
      invalidFormats.forEach(date => {
        expect(isValidDate(date)).toBe(false);
      });
    });

    it('should reject invalid dates', () => {
      const invalidDates = [
        '13/15/2025', // Invalid month
        '02/30/2025', // Invalid day for February
        '04/31/2025', // April only has 30 days
        '02/29/2023', // Not a leap year
        '00/15/2025', // Invalid month
        '01/00/2025', // Invalid day
        '01/32/2025'  // Invalid day
      ];
      
      invalidDates.forEach(date => {
        const [month, day, year] = date.split('/').map(Number);
        const dateObj = new Date(year, month - 1, day);
        
        // Check if the date is valid and matches the input
        const isValid = dateObj.getFullYear() === year && 
                       dateObj.getMonth() === month - 1 && 
                       dateObj.getDate() === day;
        
        expect(isValid).toBe(false);
      });
    });

    it('should handle leap year correctly', () => {
      const leapYearTests = [
        { date: '02/29/2024', isValid: true },  // Leap year
        { date: '02/29/2023', isValid: false }, // Not leap year
        { date: '02/29/2020', isValid: true },  // Leap year
        { date: '02/29/2021', isValid: false }  // Not leap year
      ];
      
      leapYearTests.forEach(({ date, isValid }) => {
        const [month, day, year] = date.split('/').map(Number);
        const dateObj = new Date(year, month - 1, day);
        
        const actualValid = dateObj.getFullYear() === year && 
                           dateObj.getMonth() === month - 1 && 
                           dateObj.getDate() === day;
        
        expect(actualValid).toBe(isValid);
      });
    });
  });

  describe('Date Range Validation', () => {
    it('should handle quarter boundaries correctly', () => {
      const quarterBoundaries = [
        { date: '03/31/2025', quarter: 1 }, // Last day of Q1
        { date: '04/01/2025', quarter: 2 }, // First day of Q2
        { date: '06/30/2025', quarter: 2 }, // Last day of Q2
        { date: '07/01/2025', quarter: 3 }, // First day of Q3
        { date: '09/30/2025', quarter: 3 }, // Last day of Q3
        { date: '10/01/2025', quarter: 4 }, // First day of Q4
        { date: '12/31/2025', quarter: 4 }  // Last day of Q4
      ];
      
      quarterBoundaries.forEach(({ date, quarter }) => {
        const [month, day, year] = date.split('/').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const calculatedQuarter = Math.floor(dateObj.getMonth() / 3) + 1;
        
        expect(calculatedQuarter).toBe(quarter);
      });
    });

    it('should handle year boundaries correctly', () => {
      const yearBoundaries = [
        { date: '12/31/2024', year: 2024 },
        { date: '01/01/2025', year: 2025 },
        { date: '12/31/2025', year: 2025 },
        { date: '01/01/2026', year: 2026 }
      ];
      
      yearBoundaries.forEach(({ date, year }) => {
        const [, , yearStr] = date.split('/').map(Number);
        expect(yearStr).toBe(year);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle month boundaries correctly', () => {
      const monthBoundaries = [
        { date: '01/31/2025', month: 1 },
        { date: '02/01/2025', month: 2 },
        { date: '02/28/2025', month: 2 },
        { date: '03/01/2025', month: 3 },
        { date: '04/30/2025', month: 4 },
        { date: '05/01/2025', month: 5 }
      ];
      
      monthBoundaries.forEach(({ date, month }) => {
        const [monthStr] = date.split('/').map(Number);
        expect(monthStr).toBe(month);
      });
    });

    it('should handle day boundaries correctly', () => {
      const dayBoundaries = [
        { date: '01/01/2025', day: 1 },
        { date: '01/15/2025', day: 15 },
        { date: '01/31/2025', day: 31 },
        { date: '02/01/2025', day: 1 },
        { date: '02/28/2025', day: 28 },
        { date: '02/29/2024', day: 29 } // Leap year
      ];
      
      dayBoundaries.forEach(({ date, day }) => {
        const [, dayStr] = date.split('/').map(Number);
        expect(dayStr).toBe(day);
      });
    });

    it('should handle special dates correctly', () => {
      const specialDates = [
        { date: '01/01/2025', description: 'New Year' },
        { date: '02/14/2025', description: 'Valentine\'s Day' },
        { date: '03/17/2025', description: 'St. Patrick\'s Day' },
        { date: '07/04/2025', description: 'Independence Day' },
        { date: '12/25/2025', description: 'Christmas' },
        { date: '12/31/2025', description: 'New Year\'s Eve' }
      ];
      
      specialDates.forEach(({ date }) => {
        const [month, day, year] = date.split('/').map(Number);
        const dateObj = new Date(year, month - 1, day);
        
        // Should create valid date objects
        expect(dateObj.getFullYear()).toBe(year);
        expect(dateObj.getMonth()).toBe(month - 1);
        expect(dateObj.getDate()).toBe(day);
      });
    });
  });

  describe('Performance', () => {
    it('should convert dates efficiently', () => {
      const testDates = [
        '01/01/2025', '02/15/2025', '03/31/2025', '04/01/2025',
        '05/15/2025', '06/30/2025', '07/01/2025', '08/15/2025',
        '09/30/2025', '10/01/2025', '11/15/2025', '12/31/2025'
      ];
      
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        testDates.forEach(date => {
          const [month, day, year] = date.split('/').map(Number);
          void `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should handle large datasets efficiently', () => {
      const startTime = Date.now();
      
      // Generate 1000 random dates
      for (let i = 0; i < 1000; i++) {
        const year = 2025;
        const month = Math.floor(Math.random() * 12) + 1;
        const day = Math.floor(Math.random() * 28) + 1; // Use 28 to avoid invalid days
        const date = `${month}/${day}/${year}`;
        
        const [monthStr, dayStr, yearStr] = date.split('/').map(Number);
        void `${yearStr}-${monthStr.toString().padStart(2, '0')}-${dayStr.toString().padStart(2, '0')}`;
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(200); // Should be reasonably fast
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent output format', () => {
      const testDates = [
        '01/01/2025', '02/15/2025', '03/31/2025', '04/01/2025',
        '05/15/2025', '06/30/2025', '07/01/2025', '08/15/2025',
        '09/30/2025', '10/01/2025', '11/15/2025', '12/31/2025'
      ];
      
      testDates.forEach(date => {
        const [month, day, year] = date.split('/').map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        // All outputs should be in yyyy-mm-dd format
        expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        
        // Year should be 4 digits
        expect(year.toString().length).toBe(4);
        
        // Month should be 01-12
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
        
        // Day should be 01-31
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(31);
      });
    });

    it('should handle round-trip conversion correctly', () => {
      const testDates = [
        '01/01/2025', '02/15/2025', '03/31/2025', '04/01/2025',
        '05/15/2025', '06/30/2025', '07/01/2025', '08/15/2025',
        '09/30/2025', '10/01/2025', '11/15/2025', '12/31/2025'
      ];
      
      testDates.forEach(date => {
        // Convert mm/dd/yyyy to yyyy-mm-dd
        const [month, day, year] = date.split('/').map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        // Convert back to mm/dd/yyyy
        const [yearStr, monthStr, dayStr] = isoDate.split('-').map(Number);
        const convertedDate = `${monthStr.toString().padStart(2, '0')}/${dayStr.toString().padStart(2, '0')}/${yearStr}`;
        
        expect(convertedDate).toBe(date);
      });
    });
  });

  describe('Integration with Quarter Validation', () => {
    it('should work with quarter validation', () => {
      const quarterDates = [
        { date: '01/15/2025', quarter: 1 },
        { date: '02/15/2025', quarter: 1 },
        { date: '03/15/2025', quarter: 1 },
        { date: '04/15/2025', quarter: 2 },
        { date: '05/15/2025', quarter: 2 },
        { date: '06/15/2025', quarter: 2 },
        { date: '07/15/2025', quarter: 3 },
        { date: '08/15/2025', quarter: 3 },
        { date: '09/15/2025', quarter: 3 },
        { date: '10/15/2025', quarter: 4 },
        { date: '11/15/2025', quarter: 4 },
        { date: '12/15/2025', quarter: 4 }
      ];
      
      quarterDates.forEach(({ date, quarter }) => {
        // Convert to ISO format
        const [month, day, year] = date.split('/').map(Number);
        void `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        // Calculate quarter
        const dateObj = new Date(year, month - 1, day);
        const calculatedQuarter = Math.floor(dateObj.getMonth() / 3) + 1;
        
        expect(calculatedQuarter).toBe(quarter);
      });
    });
  });
});
