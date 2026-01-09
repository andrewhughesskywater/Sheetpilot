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
} from '@/services/bot/src/config/quarter_config';

describe('Quarter Configuration', () => {
  describe('Quarter Definitions', () => {
    it('should define at least one active quarter with required fields', () => {
      expect(QUARTER_DEFINITIONS.length).toBeGreaterThan(0);
      for (const q of QUARTER_DEFINITIONS) {
        expect(typeof q.id).toBe('string');
        expect(typeof q.name).toBe('string');
        expect(typeof q.startDate).toBe('string');
        expect(typeof q.endDate).toBe('string');
        expect(typeof q.formUrl).toBe('string');
        expect(typeof q.formId).toBe('string');
        // Dates are ISO and ordered
        expect(q.startDate <= q.endDate).toBe(true);
        // formUrl should include the formId for Smartsheet forms
        expect(q.formUrl).toContain(q.formId);
      }
    });

    it('should not have overlapping quarter date ranges', () => {
      // Sort by startDate and ensure each start is after previous end
      const sorted = [...QUARTER_DEFINITIONS].sort((a, b) => a.startDate.localeCompare(b.startDate));
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].startDate > sorted[i - 1].endDate).toBe(true);
      }
    });
  });

  describe('getQuarterForDate', () => {
    it('should resolve dates inside each active quarter to that quarter', () => {
      for (const q of QUARTER_DEFINITIONS) {
        // Pick the start date as a representative date
        const quarter = getQuarterForDate(q.startDate);
        expect(quarter).not.toBeNull();
        expect(quarter!.id).toBe(q.id);
      }
    });

    it('should return null for dates outside all active quarters', () => {
      const sorted = [...QUARTER_DEFINITIONS].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      // Pick one day before first.startDate and one day after last.endDate
      const dayBeforeFirst = new Date(first.startDate);
      dayBeforeFirst.setUTCDate(dayBeforeFirst.getUTCDate() - 1);
      const dayAfterLast = new Date(last.endDate);
      dayAfterLast.setUTCDate(dayAfterLast.getUTCDate() + 1);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      expect(getQuarterForDate(fmt(dayBeforeFirst))).toBeNull();
      expect(getQuarterForDate(fmt(dayAfterLast))).toBeNull();
    });

    it('should return null for invalid dates', () => {
      expect(getQuarterForDate('')).toBeNull();
      expect(getQuarterForDate('invalid')).toBeNull();
      expect(getQuarterForDate('2025-13-01')).toBeNull(); // Invalid month
      expect(getQuarterForDate('2025-02-30')).toBeNull(); // Invalid day
    });
  });

  describe('validateQuarterAvailability', () => {
    it('should return null for a date inside an active quarter', () => {
      const anyActive = QUARTER_DEFINITIONS[0];
      expect(validateQuarterAvailability(anyActive.startDate)).toBeNull();
    });

    it('should return error message for dates outside active quarters', () => {
      const sorted = [...QUARTER_DEFINITIONS].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const first = sorted[0];
      const dayBeforeFirst = new Date(first.startDate);
      dayBeforeFirst.setUTCDate(dayBeforeFirst.getUTCDate() - 1);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const error = validateQuarterAvailability(fmt(dayBeforeFirst));
      expect(error).toBeTruthy();
      expect(error).toContain('Date must be in');
      // Error lists available quarter names; ensure it references current config
      for (const q of QUARTER_DEFINITIONS) {
        expect(error!).toContain(q.name);
      }
    });

    it('should return error for empty date', () => {
      expect(validateQuarterAvailability('')).toBe('Please enter a date');
    });
  });

  describe('groupEntriesByQuarter', () => {
    it('should group entries by active quarter correctly', () => {
      // Build one entry per active quarter using the quarter start date
      const entries = QUARTER_DEFINITIONS.map((q, i) => ({ date: q.startDate, project: `P${i + 1}` }));
      const grouped = groupEntriesByQuarter(entries);
      expect(grouped.size).toBe(QUARTER_DEFINITIONS.length);
      for (const q of QUARTER_DEFINITIONS) {
        expect(grouped.get(q.id)).toBeDefined();
        expect(grouped.get(q.id)!).toHaveLength(1);
      }
    });

    it('should handle empty entries array', () => {
      const grouped = groupEntriesByQuarter([]);
      expect(grouped.size).toBe(0);
    });

    it('should skip entries with invalid dates', () => {
      const valid = QUARTER_DEFINITIONS[0];
      const entries = [
        { date: valid.startDate, project: 'Valid' },
        { date: 'invalid', project: 'Invalid' }
      ];
      const grouped = groupEntriesByQuarter(entries);
      expect(grouped.size).toBe(1);
      expect(grouped.get(valid.id)).toHaveLength(1);
      expect(grouped.get(valid.id)![0].project).toBe('Valid');
    });
  });

  describe('Utility Functions', () => {
    it('should return available quarter IDs matching definitions', () => {
      const ids = getAvailableQuarterIds();
      expect(ids).toEqual(QUARTER_DEFINITIONS.map(q => q.id));
    });

    it('should get quarter by ID', () => {
      const any = QUARTER_DEFINITIONS[0];
      const found = getQuarterById(any.id);
      const invalid = getQuarterById('INVALID');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(any.id);
      expect(invalid).toBeNull();
    });

    it('should get current quarter based on today (if within any active range)', () => {
      const current = getCurrentQuarter();
      if (current) {
        expect(QUARTER_DEFINITIONS.map(q => q.id)).toContain(current.id);
      }
    });
  });
});
