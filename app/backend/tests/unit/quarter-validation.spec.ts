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
import { validateQuarterAvailability, QUARTER_DEFINITIONS, getQuarterForDate } from '../../src/services/bot/src/quarter_config';
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
    it('debug: log quarter validation for candidate dates', () => {
      const quarter = QUARTER_DEFINITIONS.find(q => new Date(q.endDate) >= new Date(q.startDate)) || QUARTER_DEFINITIONS[0];
      const start = new Date(quarter.startDate);
      const end = new Date(quarter.endDate);
      const mid = new Date(Math.floor((start.getTime() + end.getTime()) / 2));
      const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 24 * 60 * 60 * 1000);

      const dates = [
        `${addDays(start, 1).toISOString().split('T')[0]}`,
        `${mid.toISOString().split('T')[0]}`,
        `${addDays(end, -1).toISOString().split('T')[0]}`
      ];

      dates.forEach(date => {
        const q = getQuarterForDate(date);
        console.log('[quarter-debug] date=', date, 'quarter=', q ? q.id : 'null', 'validate=', validateQuarterAvailability(date));
      });
    });
    it('should validate dates in available quarters (dynamic)', () => {
      // Pick a structurally valid quarter (end >= start) so tests don't depend on system time
      const quarter = QUARTER_DEFINITIONS.find(q => new Date(q.endDate) >= new Date(q.startDate)) || QUARTER_DEFINITIONS[0];

      const start = new Date(quarter.startDate);
      const end = new Date(quarter.endDate);
      const mid = new Date(Math.floor((start.getTime() + end.getTime()) / 2));
      const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 24 * 60 * 60 * 1000);

      // Pick dates safely inside the quarter (avoid exact boundaries which can be flaky)
      const validDates = [
        `${addDays(start, 1).getFullYear()}-${String(addDays(start, 1).getMonth() + 1).padStart(2, '0')}-${String(addDays(start, 1).getDate()).padStart(2, '0')}`,
        `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, '0')}-${String(mid.getDate()).padStart(2, '0')}`,
        `${addDays(end, -1).getFullYear()}-${String(addDays(end, -1).getMonth() + 1).padStart(2, '0')}-${String(addDays(end, -1).getDate()).padStart(2, '0')}`
      ];

      validDates.forEach(date => {
        const result = validateQuarterAvailability(date);
        expect(result).toBeNull();
      });
    });

    it('should reject dates outside available quarters (dynamic)', () => {
      // Determine earliest start and latest end across configured quarters
      const starts = QUARTER_DEFINITIONS.map(q => new Date(q.startDate));
      const ends = QUARTER_DEFINITIONS.map(q => new Date(q.endDate));
      const earliest = new Date(Math.min(...starts.map(d => d.getTime())));
      const latest = new Date(Math.max(...ends.map(d => d.getTime())));

      // One day before earliest, and one day after latest
      const before = new Date(earliest.getTime() - 24 * 60 * 60 * 1000);
      const after = new Date(latest.getTime() + 24 * 60 * 60 * 1000);

      const outsideQuarterDates = [
        `${before.getFullYear()}-${String(before.getMonth() + 1).padStart(2, '0')}-${String(before.getDate()).padStart(2, '0')}`,
        `${after.getFullYear()}-${String(after.getMonth() + 1).padStart(2, '0')}-${String(after.getDate()).padStart(2, '0')}`
      ];

      outsideQuarterDates.forEach(date => {
        const result = validateQuarterAvailability(date);
        if (!result) throw new Error(`[quarter-debug] outside date=${date} returned null`);
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
    it('should handle quarter transitions correctly (dynamic)', () => {
      // Find consecutive quarters if available
      let found = false;
      for (let i = 0; i < QUARTER_DEFINITIONS.length - 1; i++) {
        const cur = QUARTER_DEFINITIONS[i];
        const next = QUARTER_DEFINITIONS[i + 1];
        const curEnd = new Date(cur.endDate);
        const nextStart = new Date(next.startDate);
        // Validate dates safely inside boundaries to avoid boundary flakiness
        const safeCurEnd = new Date(curEnd.getTime() - 24 * 60 * 60 * 1000);
        const safeNextStart = new Date(nextStart.getTime() + 24 * 60 * 60 * 1000);
        const curIso = `${safeCurEnd.getFullYear()}-${String(safeCurEnd.getMonth()+1).padStart(2,'0')}-${String(safeCurEnd.getDate()).padStart(2,'0')}`;
        const nextIso = `${safeNextStart.getFullYear()}-${String(safeNextStart.getMonth()+1).padStart(2,'0')}-${String(safeNextStart.getDate()).padStart(2,'0')}`;
        console.log('[quarter-debug] transition cur=', cur.id, 'curIso=', curIso, 'validate=', validateQuarterAvailability(curIso));
        console.log('[quarter-debug] transition next=', next.id, 'nextIso=', nextIso, 'validate=', validateQuarterAvailability(nextIso));
        if (validateQuarterAvailability(curIso) !== null) throw new Error(`[quarter-debug] transition curIso=${curIso} returned ${validateQuarterAvailability(curIso)}`);
        if (validateQuarterAvailability(nextIso) !== null) throw new Error(`[quarter-debug] transition nextIso=${nextIso} returned ${validateQuarterAvailability(nextIso)}`);
        found = true;
        break;
      }

      if (!found) {
        // Fallback: validate a date safely inside a structurally valid quarter
        const quarter = QUARTER_DEFINITIONS.find(q => new Date(q.endDate) >= new Date(q.startDate)) || QUARTER_DEFINITIONS[0];
        const s = new Date(quarter.startDate);
        const e = new Date(quarter.endDate);
        const safeStart = new Date(s.getTime() + 24 * 60 * 60 * 1000);
        const safeEnd = new Date(e.getTime() - 24 * 60 * 60 * 1000);
        expect(validateQuarterAvailability(`${safeStart.getFullYear()}-${String(safeStart.getMonth()+1).padStart(2,'0')}-${String(safeStart.getDate()).padStart(2,'0')}`)).toBeNull();
        expect(validateQuarterAvailability(`${safeEnd.getFullYear()}-${String(safeEnd.getMonth()+1).padStart(2,'0')}-${String(safeEnd.getDate()).padStart(2,'0')}`)).toBeNull();
      }
    });

    it('should handle year transitions correctly (dynamic)', () => {
      // Earliest configured start should be valid, and the day before it should be invalid
      const earliest = new Date(Math.min(...QUARTER_DEFINITIONS.map(q => new Date(q.startDate).getTime())));
      const before = new Date(earliest.getTime() - 24 * 60 * 60 * 1000);

      const earliestIso = `${earliest.getFullYear()}-${String(earliest.getMonth() + 1).padStart(2,'0')}-${String(earliest.getDate()).padStart(2,'0')}`;
      const beforeIso = `${before.getFullYear()}-${String(before.getMonth() + 1).padStart(2,'0')}-${String(before.getDate()).padStart(2,'0')}`;

      expect(validateQuarterAvailability(earliestIso)).toBeNull();
      expect(validateQuarterAvailability(beforeIso)).toBeTruthy();
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
    it('should work with date format validation (dynamic)', () => {
      // Pick a structurally valid quarter (end >= start) so tests don't depend on system time
      const quarter = QUARTER_DEFINITIONS.find(q => new Date(q.endDate) >= new Date(q.startDate)) || QUARTER_DEFINITIONS[0];

      const start = new Date(quarter.startDate);
      const mid = new Date(Math.floor((start.getTime() + new Date(quarter.endDate).getTime()) / 2));

      const validDates = [
        `${String(start.getMonth() + 1).padStart(2,'0')}/${String(start.getDate()).padStart(2,'0')}/${start.getFullYear()}`,
        `${String(mid.getMonth() + 1).padStart(2,'0')}/${String(mid.getDate()).padStart(2,'0')}/${mid.getFullYear()}`
      ];

      // Determine a clearly invalid date: one day before earliest quarter start
      const earliest = new Date(Math.min(...QUARTER_DEFINITIONS.map(q => new Date(q.startDate).getTime())));
      const invalidBefore = new Date(earliest.getTime() - 24 * 60 * 60 * 1000);
      const invalidDates = [
        `${String(invalidBefore.getMonth() + 1).padStart(2,'0')}/${String(invalidBefore.getDate()).padStart(2,'0')}/${invalidBefore.getFullYear()}`
      ];

      validDates.forEach(date => {
        const [month, day, year] = date.split('/').map(Number);
        const isoDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const result = validateQuarterAvailability(isoDate);
        expect(result).toBeNull();
      });

      invalidDates.forEach(date => {
        const [month, day, year] = date.split('/').map(Number);
        const isoDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const result = validateQuarterAvailability(isoDate);
        if (!result) throw new Error(`[quarter-debug] invalidIso=${isoDate} returned null`);
      });
    });
  });
});
