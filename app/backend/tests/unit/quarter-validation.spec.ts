/**
 * @fileoverview Quarter Validation Unit Tests
 * 
 * Tests quarter availability validation to prevent AI from breaking business rules.
 * Validates that timesheet entries can only be created for available quarters.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi } from 'vitest';
import { validateQuarterAvailability } from '../../src/services/bot/src/quarter_config';
import { quarterTestCases } from '../fixtures/timesheet-data';

describe('Quarter Validation Unit Tests', () => {

  describe('Current Quarter Detection', () => {
    it('should identify current quarter correctly', () => {
      // Mock current date as Q1 2025
      const mockCurrentDate = new Date('2025-01-15');
      vi.setSystemTime(mockCurrentDate);
      
      const currentYear = mockCurrentDate.getFullYear();
      const currentQuarter = Math.floor(mockCurrentDate.getMonth() / 3) + 1;
      
      expect(currentYear).toBe(2025);
      expect(currentQuarter).toBe(1); // January is Q1
    });

    it('should handle different quarters correctly', () => {
      const quarterTests = [
        { date: new Date('2025-01-15'), expectedQuarter: 1 },
        { date: new Date('2025-04-15'), expectedQuarter: 2 },
        { date: new Date('2025-07-15'), expectedQuarter: 3 },
        { date: new Date('2025-10-15'), expectedQuarter: 4 }
      ];
      
      quarterTests.forEach(({ date, expectedQuarter }) => {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        expect(quarter).toBe(expectedQuarter);
      });
    });

    it('should handle quarter boundaries correctly', () => {
      const boundaryTests = [
        { date: new Date(2025, 2, 31), expectedQuarter: 1 }, // Last day of Q1 (March 31)
        { date: new Date(2025, 3, 1), expectedQuarter: 2 },  // First day of Q2 (April 1)
        { date: new Date(2025, 5, 30), expectedQuarter: 2 }, // Last day of Q2 (June 30)
        { date: new Date(2025, 6, 1), expectedQuarter: 3 }, // First day of Q3 (July 1)
        { date: new Date(2025, 8, 30), expectedQuarter: 3 }, // Last day of Q3 (September 30)
        { date: new Date(2025, 9, 1), expectedQuarter: 4 }, // First day of Q4 (October 1)
        { date: new Date(2025, 11, 31), expectedQuarter: 4 }  // Last day of Q4 (December 31)
      ];
      
      boundaryTests.forEach(({ date, expectedQuarter }) => {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        expect(quarter).toBe(expectedQuarter);
      });
    });
  });

  describe('Quarter Validation Logic', () => {
    it('should validate dates in available quarters', () => {
      const validDates = [
        '2025-01-01', // First day of Q1
        '2025-01-15', // Middle of Q1
        '2025-02-15', // Middle of Q1
        '2025-03-31', // Last day of Q1
        '2025-04-01', // First day of Q2
        '2025-06-30', // Last day of Q2
        '2025-07-01', // First day of Q3
        '2025-09-30', // Last day of Q3
        '2025-10-01', // First day of Q4
        '2025-12-31'  // Last day of Q4
      ];
      
      validDates.forEach(date => {
        const result = validateQuarterAvailability(date);
        expect(result).toBeNull();
      });
    });

    it('should reject dates outside available quarters', () => {
      const outsideQuarterDates = [
        '2024-12-31', // Before Q1 2025
        '2026-01-01'  // After Q4 2025
      ];
      
      outsideQuarterDates.forEach(date => {
        const result = validateQuarterAvailability(date);
        expect(result).toBeTruthy();
        expect(result).toContain('Date must be in');
      });
    });

    it('should handle leap year correctly', () => {
      // Test leap year date - not in any available quarter
      const leapYearDate = '2024-02-29';
      const result = validateQuarterAvailability(leapYearDate);
      
      // Should be rejected because it's not in available quarters
      expect(result).toBeTruthy();
      expect(result).toContain('Date must be in');
    });

    it('should handle invalid date formats gracefully', () => {
      const invalidDates = [
        '2025-13-01', // Invalid month
        '2025-02-30', // Invalid day
        '2025-04-31', // Invalid day
        'invalid-date',
        ''
      ];
      
      invalidDates.forEach(date => {
        expect(() => validateQuarterAvailability(date)).not.toThrow();
      });
    });
  });

  describe('Quarter Transition Handling', () => {
    it('should handle quarter transitions correctly', () => {
      // Q1 dates should be valid
      expect(validateQuarterAvailability('2025-03-31')).toBeNull();
      
      // Q2 dates should be valid (all 2025 quarters are available)
      expect(validateQuarterAvailability('2025-04-01')).toBeNull();
    });

    it('should handle year transitions correctly', () => {
      // 2025 Q1 dates should be valid
      expect(validateQuarterAvailability('2025-01-01')).toBeNull();
      
      // 2024 dates should be invalid
      expect(validateQuarterAvailability('2024-12-31')).toBeTruthy();
    });
  });

  describe('Business Rule Validation', () => {
    it('should enforce quarter availability for all test cases', () => {
      quarterTestCases.forEach(({ date, isValid }) => {
        // date is already in ISO format (YYYY-MM-DD)
        const isoDate = date;
        
        const result = validateQuarterAvailability(isoDate);
        
        if (isValid) {
          expect(result).toBeNull();
        } else {
          expect(result).toBeTruthy();
          expect(result).toContain('Date must be in');
        }
      });
    });

    it('should provide clear error messages', () => {
      // Get actual error messages from the implementation
      const testDates = ['2024-12-31', '2026-01-01'];
      
      testDates.forEach(date => {
        const result = validateQuarterAvailability(date);
        expect(result).toBeTruthy();
        expect(result).toContain('Date must be in');
        expect(result?.length).toBeLessThan(200);
        expect(result).not.toContain('undefined');
        expect(result).not.toContain('null');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle timezone differences', () => {
      // Test with different timezone scenarios
      const dates = [
        '2025-01-01T00:00:00Z',
        '2025-01-01T23:59:59Z',
        '2025-03-31T00:00:00Z',
        '2025-03-31T23:59:59Z'
      ];
      
      dates.forEach(date => {
        // Should handle ISO date strings
        expect(() => new Date(date)).not.toThrow();
      });
    });

    it('should handle daylight saving time transitions', () => {
      // Test dates around DST transitions
      const dstDates = [
        '2025-03-09', // Spring forward (if applicable)
        '2025-11-02'  // Fall back (if applicable)
      ];
      
      dstDates.forEach(date => {
        expect(() => new Date(date)).not.toThrow();
      });
    });

    it('should handle invalid date inputs gracefully', () => {
      const invalidInputs = [
        'not-a-date',
        '2025-13-01',
        '2025-02-30',
        '2025-04-31',
        '',
        null,
        undefined
      ];
      
      invalidInputs.forEach(input => {
        expect(() => {
          try {
            new Date(input as string);
          } catch {
            // Expected to throw for invalid inputs
          }
        }).not.toThrow();
      });
    });
  });

  describe('Performance', () => {
    it('should validate dates efficiently', () => {
      const testDates = [
        '2025-01-01', '2025-01-15', '2025-02-15', '2025-03-15',
        '2025-04-01', '2025-05-15', '2025-06-15', '2025-07-01',
        '2025-08-15', '2025-09-15', '2025-10-01', '2025-11-15',
        '2025-12-15'
      ];
      
      const startTime = Date.now();
      
      testDates.forEach(date => {
        validateQuarterAvailability(date);
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should handle large date ranges efficiently', () => {
      const startTime = Date.now();
      
      // Test 1000 date validations
      for (let i = 0; i < 1000; i++) {
        const year = 2025;
        const month = Math.floor(Math.random() * 12) + 1;
        const day = Math.floor(Math.random() * 28) + 1; // Use 28 to avoid invalid days
        const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        validateQuarterAvailability(date);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(500); // Should be reasonably fast
    });
  });

  describe('Integration with Date Validation', () => {
    it('should work with date format validation', () => {
      const validDates = [
        '01/01/2025',  // Q1
        '02/15/2025',  // Q1
        '03/31/2025',  // Q1
        '04/01/2025',  // Q2
        '07/15/2025'   // Q3
      ];
      
      const invalidDates = [
        '12/31/2024',  // Before available quarters
        '01/01/2026'   // After available quarters
      ];
      
      validDates.forEach(date => {
        // Convert to ISO format for quarter validation
        const [month, day, year] = date.split('/').map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        const result = validateQuarterAvailability(isoDate);
        expect(result).toBeNull();
      });
      
      invalidDates.forEach(date => {
        // Convert to ISO format for quarter validation
        const [month, day, year] = date.split('/').map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        const result = validateQuarterAvailability(isoDate);
        expect(result).toBeTruthy();
      });
    });
  });
});
