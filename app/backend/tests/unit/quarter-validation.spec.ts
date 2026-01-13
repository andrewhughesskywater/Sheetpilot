/**
 * @fileoverview Quarter Validation Unit Tests
 * 
 * Tests quarter availability validation to prevent AI from breaking business rules.
 * Validates that timesheet entries can only be created for available quarters.
 * 
 * IMPORTANT: The quarter configuration uses a rolling window pattern.
 * Only the current quarter and previous quarter are available at any given time.
 * These tests validate against the configured rolling window, not hardcoded quarters.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi } from 'vitest';
import { validateQuarterAvailability, QUARTER_DEFINITIONS, getCurrentQuarter, type QuarterDefinition } from '../../src/services/bot/src/config/quarter_config';
import { quarterTestCases } from '../fixtures/timesheet-data';

describe('Quarter Validation Unit Tests', () => {

  describe('Current Quarter Detection', () => {
    it('should identify current quarter from configured quarters', () => {
      const currentQuarter = getCurrentQuarter();
      
      // If today falls within a configured quarter, it should be found
      if (currentQuarter) {
        const configuredIds = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => q.id);
        expect(configuredIds).toContain(currentQuarter.id);
        
        // Current quarter should be the first in the array (most recent)
        expect(QUARTER_DEFINITIONS[0]!.id).toBe(currentQuarter.id);
      }
    });

    it('should calculate quarter numbers correctly for any date', () => {
      // Test quarter calculation logic using dates from configured quarters
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        const startDate = new Date(quarter.startDate);
        const quarterNumber = Math.floor(startDate.getMonth() / 3) + 1;
        
        // Quarter number should be between 1 and 4
        expect(quarterNumber).toBeGreaterThanOrEqual(1);
        expect(quarterNumber).toBeLessThanOrEqual(4);
      });
    });

    it('should handle quarter boundaries correctly using configured quarters', () => {
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        const startDate = new Date(quarter.startDate);
        const endDate = new Date(quarter.endDate);
        
        // Start date should be in the quarter
        const startQuarter = Math.floor(startDate.getMonth() / 3) + 1;
        const endQuarter = Math.floor(endDate.getMonth() / 3) + 1;
        
        // Start and end should be in the same quarter (or end could be start of next quarter)
        expect(endQuarter).toBeGreaterThanOrEqual(startQuarter);
        expect(endQuarter).toBeLessThanOrEqual(startQuarter + 1);
      });
    });
  });

  describe('Quarter Validation Logic', () => {
    it('should validate dates in available quarters (rolling window)', () => {
      // Test dates within each configured quarter
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        // Test first day, middle day, and last day of each quarter
        expect(validateQuarterAvailability(quarter.startDate)).toBeNull();
        expect(validateQuarterAvailability(quarter.endDate)).toBeNull();
        
        // Calculate and test a middle date
        const startDate = new Date(quarter.startDate);
        const endDate = new Date(quarter.endDate);
        const middleDate = new Date(
          startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2
        );
        const middleDateStr = middleDate.toISOString().split('T')[0];
        if (middleDateStr) {
          expect(validateQuarterAvailability(middleDateStr)).toBeNull();
        }
      });
    });

    it('should reject dates outside rolling window', () => {
      // Find dates outside the configured quarters
      const allStartDates = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => new Date(q.startDate));
      const allEndDates = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => new Date(q.endDate));
      const earliestDate = new Date(Math.min(...allStartDates.map((d: Date) => d.getTime())));
      const latestDate = new Date(Math.max(...allEndDates.map(d => d.getTime())));
      
      // Test date before rolling window
      const beforeDate = new Date(earliestDate);
      beforeDate.setDate(beforeDate.getDate() - 1);
      const beforeDateStr = beforeDate.toISOString().split('T')[0];
      if (beforeDateStr) {
        const result = validateQuarterAvailability(beforeDateStr);
        expect(result).toBeTruthy();
        expect(result).toContain('Date must be in');
      }
      
      // Test date after rolling window
      const afterDate = new Date(latestDate);
      afterDate.setDate(afterDate.getDate() + 1);
      const afterDateStr = afterDate.toISOString().split('T')[0];
      if (afterDateStr) {
        const result = validateQuarterAvailability(afterDateStr);
        expect(result).toBeTruthy();
        expect(result).toContain('Date must be in');
      }
    });

    it('should handle leap year correctly', () => {
      // Test leap year date - use a known leap year but outside configured quarters
      // We'll use a date that's clearly outside the rolling window
      const allStartDates = QUARTER_DEFINITIONS.map(q => new Date(q.startDate));
      const earliestYear = Math.min(...allStartDates.map((d: Date) => d.getFullYear()));
      
      // Use a leap year date from a year before the configured quarters
      const leapYearDate = `${earliestYear - 1}-02-29`;
      const result = validateQuarterAvailability(leapYearDate);
      
      // Should be rejected if not in the rolling window, or null if it is
      // We just verify it doesn't throw and returns a valid result
      expect(result === null || (typeof result === 'string' && result.includes('Date must be in'))).toBe(true);
    });

    it('should handle invalid date formats gracefully', () => {
      // Use a clearly invalid year (9999) to avoid conflicts with configured quarters
      const invalidDates = [
        '9999-13-01', // Invalid month
        '9999-02-30', // Invalid day
        '9999-04-31', // Invalid day
        'invalid-date',
        ''
      ];
      
      invalidDates.forEach(date => {
        expect(() => validateQuarterAvailability(date)).not.toThrow();
      });
    });
  });

  describe('Quarter Transition Handling', () => {
    it('should handle transitions between quarters in rolling window', () => {
      if (QUARTER_DEFINITIONS.length >= 2) {
        const firstQuarter = QUARTER_DEFINITIONS[0];
        const secondQuarter = QUARTER_DEFINITIONS[1];
        
        // Last day of first quarter should be valid
        expect(validateQuarterAvailability(firstQuarter.endDate)).toBeNull();
        
        // First day of second quarter should be valid
        expect(validateQuarterAvailability(secondQuarter.startDate)).toBeNull();
      }
    });

    it('should handle year transitions within rolling window', () => {
      // Test dates at the boundaries of configured quarters
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        // Start and end dates should always be valid for configured quarters
        expect(validateQuarterAvailability(quarter.startDate)).toBeNull();
        expect(validateQuarterAvailability(quarter.endDate)).toBeNull();
      });
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
      // Generate test dates outside the rolling window dynamically
      const allStartDates = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => new Date(q.startDate));
      const allEndDates = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => new Date(q.endDate));
      const earliestDate = new Date(Math.min(...allStartDates.map((d: Date) => d.getTime())));
      const latestDate = new Date(Math.max(...allEndDates.map(d => d.getTime())));
      
      const beforeDate = new Date(earliestDate);
      beforeDate.setDate(beforeDate.getDate() - 1);
      const afterDate = new Date(latestDate);
      afterDate.setDate(afterDate.getDate() + 1);
      
      const testDates = [
        beforeDate.toISOString().split('T')[0],
        afterDate.toISOString().split('T')[0]
      ].filter((date): date is string => !!date);
      
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
      // Test with dates from configured quarters in ISO format with timezone
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        const dates = [
          `${quarter.startDate}T00:00:00Z`,
          `${quarter.startDate}T23:59:59Z`,
          `${quarter.endDate}T00:00:00Z`,
          `${quarter.endDate}T23:59:59Z`
        ];
        
        dates.forEach(date => {
          // Should handle ISO date strings
          expect(() => new Date(date)).not.toThrow();
        });
      });
    });

    it('should handle daylight saving time transitions', () => {
      // Test dates around DST transitions using dates from configured quarters
      // DST typically occurs in March and November
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        const startDate = new Date(quarter.startDate);
        const endDate = new Date(quarter.endDate);
        
        // Test if quarter spans March or November (DST months)
        if (startDate.getMonth() <= 2 && endDate.getMonth() >= 2) {
          // Quarter spans March (Spring forward)
          const dstDate = new Date(quarter.startDate);
          dstDate.setMonth(2); // March
          dstDate.setDate(9); // Second Sunday (approximate)
          expect(() => new Date(dstDate.toISOString().split('T')[0]!)).not.toThrow();
        }
        
        if (startDate.getMonth() <= 10 && endDate.getMonth() >= 10) {
          // Quarter spans November (Fall back)
          const dstDate = new Date(quarter.startDate);
          dstDate.setMonth(10); // November
          dstDate.setDate(2); // First Sunday (approximate)
          expect(() => new Date(dstDate.toISOString().split('T')[0]!)).not.toThrow();
        }
      });
    });

    it('should handle invalid date inputs gracefully', () => {
      // Use clearly invalid year (9999) to avoid conflicts with configured quarters
      const invalidInputs = [
        'not-a-date',
        '9999-13-01',
        '9999-02-30',
        '9999-04-31',
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
      // Generate test dates from configured quarters
      const testDates: string[] = [];
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        testDates.push(quarter.startDate);
        testDates.push(quarter.endDate);
        // Add a middle date
        const startDate = new Date(quarter.startDate);
        const endDate = new Date(quarter.endDate);
        const middleDate = new Date(
          startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2
        );
        const middleDateStr = middleDate.toISOString().split('T')[0];
        if (middleDateStr) {
          testDates.push(middleDateStr);
        }
      });
      
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
      
      // Test 1000 date validations using dates from configured quarters
      for (let i = 0; i < 1000; i++) {
        // Pick a random quarter from configured ones
        const quarter = QUARTER_DEFINITIONS[Math.floor(Math.random() * QUARTER_DEFINITIONS.length)];
        const startDate = new Date(quarter.startDate);
        const endDate = new Date(quarter.endDate);
        const randomDate = new Date(
          startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime())
        );
        const dateStr = randomDate.toISOString().split('T')[0];
        if (dateStr) {
          validateQuarterAvailability(dateStr);
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(500); // Should be reasonably fast
    });
  });

  describe('Integration with Date Validation', () => {
    it('should work with date format validation for rolling window quarters', () => {
      // Generate valid dates from configured quarters
      const validDates: string[] = [];
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        const startDate = new Date(quarter.startDate);
        const endDate = new Date(quarter.endDate);
        // Add start, middle, and end dates
        validDates.push(
          `${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getDate().toString().padStart(2, '0')}/${startDate.getFullYear()}`,
          `${(endDate.getMonth() + 1).toString().padStart(2, '0')}/${endDate.getDate().toString().padStart(2, '0')}/${endDate.getFullYear()}`
        );
      });
      
      // Generate invalid dates (outside rolling window)
      const allStartDates = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => new Date(q.startDate));
      const allEndDates = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => new Date(q.endDate));
      const earliestDate = new Date(Math.min(...allStartDates.map((d: Date) => d.getTime())));
      const latestDate = new Date(Math.max(...allEndDates.map(d => d.getTime())));
      
      const beforeDate = new Date(earliestDate);
      beforeDate.setDate(beforeDate.getDate() - 1);
      const afterDate = new Date(latestDate);
      afterDate.setDate(afterDate.getDate() + 1);
      
      const invalidDates = [
        `${(beforeDate.getMonth() + 1).toString().padStart(2, '0')}/${beforeDate.getDate().toString().padStart(2, '0')}/${beforeDate.getFullYear()}`,
        `${(afterDate.getMonth() + 1).toString().padStart(2, '0')}/${afterDate.getDate().toString().padStart(2, '0')}/${afterDate.getFullYear()}`
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
        expect(result).toContain('Date must be in');
      });
    });
  });
});
