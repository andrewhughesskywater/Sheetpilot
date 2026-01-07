/**
 * @fileoverview Quarter Configuration Tests
 * 
 * Tests for quarter-based form routing functionality
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import { 
  QUARTER_DEFINITIONS, 
  getQuarterForDate, 
  validateQuarterAvailability, 
  groupEntriesByQuarter,
  getAvailableQuarterIds,
  getQuarterById,
  getCurrentQuarter
} from '../src/services/bot/src/config/quarter_config';

describe('Quarter Configuration', () => {
  describe('Quarter Definitions', () => {
    it('should have Q1, Q2, Q3 and Q4 2025 defined', () => {
      expect(QUARTER_DEFINITIONS).toHaveLength(4);
      expect(QUARTER_DEFINITIONS[0].id).toBe('Q1-2025');
      expect(QUARTER_DEFINITIONS[1].id).toBe('Q2-2025');
      expect(QUARTER_DEFINITIONS[2].id).toBe('Q3-2025');
      expect(QUARTER_DEFINITIONS[3].id).toBe('Q4-2025');
    });

    it('should have correct date ranges', () => {
      const q1 = QUARTER_DEFINITIONS[0];
      const q2 = QUARTER_DEFINITIONS[1];
      const q3 = QUARTER_DEFINITIONS[2];
      const q4 = QUARTER_DEFINITIONS[3];
      
      expect(q1.startDate).toBe('2025-01-01');
      expect(q1.endDate).toBe('2025-03-31');
      expect(q2.startDate).toBe('2025-04-01');
      expect(q2.endDate).toBe('2025-06-30');
      expect(q3.startDate).toBe('2025-07-01');
      expect(q3.endDate).toBe('2025-09-30');
      expect(q4.startDate).toBe('2025-10-01');
      expect(q4.endDate).toBe('2025-12-31');
    });

    it('should have different form URLs and IDs', () => {
      const q1 = QUARTER_DEFINITIONS[0];
      const q2 = QUARTER_DEFINITIONS[1];
      const q3 = QUARTER_DEFINITIONS[2];
      const q4 = QUARTER_DEFINITIONS[3];
      
      expect(q1.formUrl).not.toBe(q2.formUrl);
      expect(q1.formId).not.toBe(q2.formId);
      expect(q3.formUrl).not.toBe(q4.formUrl);
      expect(q3.formId).not.toBe(q4.formId);
      expect(q3.formId).toBe('0197cbae7daf72bdb96b3395b500d414');
      expect(q4.formId).toBe('0199fabee6497e60abb6030c48d84585');
    });
  });

  describe('getQuarterForDate', () => {
    it('should return Q3 for July dates', () => {
      const quarter = getQuarterForDate('2025-07-15');
      expect(quarter).not.toBeNull();
      expect(quarter!.id).toBe('Q3-2025');
    });

    it('should return Q3 for August dates', () => {
      const quarter = getQuarterForDate('2025-08-15');
      expect(quarter).not.toBeNull();
      expect(quarter!.id).toBe('Q3-2025');
    });

    it('should return Q3 for September dates', () => {
      const quarter = getQuarterForDate('2025-09-15');
      expect(quarter).not.toBeNull();
      expect(quarter!.id).toBe('Q3-2025');
    });

    it('should return Q4 for October dates', () => {
      const quarter = getQuarterForDate('2025-10-15');
      expect(quarter).not.toBeNull();
      expect(quarter!.id).toBe('Q4-2025');
    });

    it('should return Q4 for November dates', () => {
      const quarter = getQuarterForDate('2025-11-15');
      expect(quarter).not.toBeNull();
      expect(quarter!.id).toBe('Q4-2025');
    });

    it('should return Q4 for December dates', () => {
      const quarter = getQuarterForDate('2025-12-15');
      expect(quarter).not.toBeNull();
      expect(quarter!.id).toBe('Q4-2025');
    });

    it('should return null for dates outside quarters', () => {
      expect(getQuarterForDate('2026-01-15')).toBeNull(); // Next year
      expect(getQuarterForDate('2024-12-31')).toBeNull(); // Previous year
    });

    it('should handle edge dates correctly', () => {
      expect(getQuarterForDate('2025-07-01')?.id).toBe('Q3-2025'); // First day of Q3
      expect(getQuarterForDate('2025-09-30')?.id).toBe('Q3-2025'); // Last day of Q3
      expect(getQuarterForDate('2025-10-01')?.id).toBe('Q4-2025'); // First day of Q4
      expect(getQuarterForDate('2025-12-31')?.id).toBe('Q4-2025'); // Last day of Q4
    });

    it('should return null for invalid dates', () => {
      expect(getQuarterForDate('')).toBeNull();
      expect(getQuarterForDate('invalid')).toBeNull();
      expect(getQuarterForDate('2025-13-01')).toBeNull(); // Invalid month
      expect(getQuarterForDate('2025-02-30')).toBeNull(); // Invalid day
    });
  });

  describe('validateQuarterAvailability', () => {
    it('should return null for valid Q3 dates', () => {
      expect(validateQuarterAvailability('2025-07-15')).toBeNull();
      expect(validateQuarterAvailability('2025-08-15')).toBeNull();
      expect(validateQuarterAvailability('2025-09-15')).toBeNull();
    });

    it('should return null for valid Q4 dates', () => {
      expect(validateQuarterAvailability('2025-10-15')).toBeNull();
      expect(validateQuarterAvailability('2025-11-15')).toBeNull();
      expect(validateQuarterAvailability('2025-12-15')).toBeNull();
    });

    it('should return error message for invalid dates', () => {
      const error = validateQuarterAvailability('2026-01-15');
      expect(error).toContain('Date must be in');
      expect(error).toContain('Q1 2025');
      expect(error).toContain('Q2 2025');
      expect(error).toContain('Q3 2025');
      expect(error).toContain('Q4 2025');
    });

    it('should return error for empty date', () => {
      expect(validateQuarterAvailability('')).toBe('Please enter a date');
    });
  });

  describe('groupEntriesByQuarter', () => {
    it('should group entries by quarter correctly', () => {
      const entries = [
        { date: '2025-07-15', project: 'Project A' },
        { date: '2025-08-15', project: 'Project B' },
        { date: '2025-10-15', project: 'Project C' },
        { date: '2025-11-15', project: 'Project D' },
      ];

      const grouped = groupEntriesByQuarter(entries);
      
      expect(grouped.size).toBe(2);
      expect(grouped.get('Q3-2025')).toHaveLength(2);
      expect(grouped.get('Q4-2025')).toHaveLength(2);
      
      expect(grouped.get('Q3-2025')![0].project).toBe('Project A');
      expect(grouped.get('Q3-2025')![1].project).toBe('Project B');
      expect(grouped.get('Q4-2025')![0].project).toBe('Project C');
      expect(grouped.get('Q4-2025')![1].project).toBe('Project D');
    });

    it('should handle empty entries array', () => {
      const grouped = groupEntriesByQuarter([]);
      expect(grouped.size).toBe(0);
    });

    it('should skip entries with invalid dates', () => {
      const entries = [
        { date: '2025-07-15', project: 'Valid' },
        { date: '2026-01-15', project: 'Invalid' }, // Outside quarters
        { date: 'invalid', project: 'Invalid' },
      ];

      const grouped = groupEntriesByQuarter(entries);
      expect(grouped.size).toBe(1);
      expect(grouped.get('Q3-2025')).toHaveLength(1);
      expect(grouped.get('Q3-2025')![0].project).toBe('Valid');
    });
  });

  describe('Utility Functions', () => {
    it('should return available quarter IDs', () => {
      const ids = getAvailableQuarterIds();
      expect(ids).toEqual(['Q1-2025', 'Q2-2025', 'Q3-2025', 'Q4-2025']);
    });

    it('should get quarter by ID', () => {
      const q3 = getQuarterById('Q3-2025');
      const q4 = getQuarterById('Q4-2025');
      const invalid = getQuarterById('INVALID');
      
      expect(q3).not.toBeNull();
      expect(q3!.id).toBe('Q3-2025');
      expect(q4).not.toBeNull();
      expect(q4!.id).toBe('Q4-2025');
      expect(invalid).toBeNull();
    });

    it('should get current quarter based on today', () => {
      // This test might be flaky depending on when it runs
      // We'll just verify it returns a valid quarter or null
      const current = getCurrentQuarter();
      if (current) {
        expect(['Q1-2025', 'Q2-2025', 'Q3-2025', 'Q4-2025']).toContain(current.id);
      }
      // If current is null, that's also valid (if today is outside 2025 quarters)
    });
  });
});
