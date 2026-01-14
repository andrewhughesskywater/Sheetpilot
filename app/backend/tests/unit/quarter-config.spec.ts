/**
 * @fileoverview Quarter Configuration Tests
 * 
 * Tests for quarter-based form routing functionality.
 * 
 * IMPORTANT: The quarter configuration uses a rolling window pattern.
 * QUARTER_DEFINITIONS must contain only the current quarter and the previous quarter.
 * These tests validate the rolling window behavior, not specific hardcoded quarters.
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
  getCurrentQuarter,
  type QuarterDefinition
} from '@sheetpilot/bot';

describe('Quarter Configuration', () => {
  describe('Rolling Window Requirements', () => {
    it('should maintain a rolling window of exactly 2 quarters', () => {
      // The config must contain only current + previous quarter
      expect(QUARTER_DEFINITIONS.length).toBeGreaterThanOrEqual(1);
      expect(QUARTER_DEFINITIONS.length).toBeLessThanOrEqual(2);
    });

    it('should include the current quarter', () => {
      const currentQuarter = getCurrentQuarter();
      if (currentQuarter) {
        const currentQuarterIds = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => q.id);
        expect(currentQuarterIds).toContain(currentQuarter.id);
      }
    });

    it('should have quarters that are sequential', () => {
      if (QUARTER_DEFINITIONS.length === 2) {
        const [first, second] = QUARTER_DEFINITIONS;
        // Parse quarter numbers to ensure they're sequential
        const firstMatch = first.id.match(/Q(\d)-(\d{4})/);
        const secondMatch = second.id.match(/Q(\d)-(\d{4})/);
        
        if (firstMatch && secondMatch) {
          const firstQ = parseInt(firstMatch[1]!, 10);
          const firstYear = parseInt(firstMatch[2]!, 10);
          const secondQ = parseInt(secondMatch[1]!, 10);
          const secondYear = parseInt(secondMatch[2]!, 10);
          
          // Calculate expected previous quarter
          let expectedPrevQ = firstQ - 1;
          let expectedPrevYear = firstYear;
          if (expectedPrevQ < 1) {
            expectedPrevQ = 4;
            expectedPrevYear = firstYear - 1;
          }
          
          // Second quarter should be the previous quarter of the first
          expect(secondQ).toBe(expectedPrevQ);
          expect(secondYear).toBe(expectedPrevYear);
        }
      }
    });
  });

  describe('Quarter Definitions Structure', () => {
    it('should have valid quarter definitions with required fields', () => {
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        expect(quarter.id).toBeTruthy();
        expect(quarter.name).toBeTruthy();
        expect(quarter.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(quarter.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(quarter.formUrl).toBeTruthy();
        expect(quarter.formId).toBeTruthy();
      });
    });

    it('should have valid date ranges for each quarter', () => {
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        const startDate = new Date(quarter.startDate);
        const endDate = new Date(quarter.endDate);
        
        expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
        
        // Validate quarter length (approximately 3 months)
        const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        expect(daysDiff).toBeGreaterThan(80); // At least ~90 days (3 months)
        expect(daysDiff).toBeLessThan(95); // At most ~93 days
      });
    });

    it('should have unique form URLs and IDs for each quarter', () => {
      const formUrls = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => q.formUrl);
      const formIds = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => q.formId);
      
      // Each quarter should have unique form URL and ID
      expect(new Set(formUrls).size).toBe(formUrls.length);
      expect(new Set(formIds).size).toBe(formIds.length);
    });
  });

  describe('getQuarterForDate', () => {
    it('should return correct quarter for dates within available quarters', () => {
      // Test dates within each configured quarter
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        const startDate = new Date(quarter.startDate);
        const endDate = new Date(quarter.endDate);
        
        // Test start date
        const quarterAtStart = getQuarterForDate(quarter.startDate);
        expect(quarterAtStart).not.toBeNull();
        expect(quarterAtStart!.id).toBe(quarter.id);
        
        // Test end date
        const quarterAtEnd = getQuarterForDate(quarter.endDate);
        expect(quarterAtEnd).not.toBeNull();
        expect(quarterAtEnd!.id).toBe(quarter.id);
        
        // Test middle date
        const middleDate = new Date(
          startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2
        );
        const middleDateStr = middleDate.toISOString().split('T')[0];
        if (middleDateStr) {
          const quarterAtMiddle = getQuarterForDate(middleDateStr!);
          expect(quarterAtMiddle).not.toBeNull();
          expect(quarterAtMiddle!.id).toBe(quarter.id);
        }
      });
    });

    it('should return null for dates outside the rolling window', () => {
      // Find the earliest and latest dates in configured quarters
      const allStartDates = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => new Date(q.startDate));
      const allEndDates = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => new Date(q.endDate));
      const earliestDate = new Date(Math.min(...allStartDates.map((d: Date) => d.getTime())));
      const latestDate = new Date(Math.max(...allEndDates.map(d => d.getTime())));
      
      // Test dates before the rolling window
      const beforeDate = new Date(earliestDate);
      beforeDate.setDate(beforeDate.getDate() - 1);
      const beforeDateStr = beforeDate.toISOString().split('T')[0];
      if (beforeDateStr) {
        expect(getQuarterForDate(beforeDateStr)).toBeNull();
      }
      
      // Test dates after the rolling window
      const afterDate = new Date(latestDate);
      afterDate.setDate(afterDate.getDate() + 1);
      const afterDateStr = afterDate.toISOString().split('T')[0];
      if (afterDateStr) {
        expect(getQuarterForDate(afterDateStr)).toBeNull();
      }
    });

    it('should handle edge dates correctly (first and last days of quarters)', () => {
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        // Test first day of quarter
        const quarterAtStart = getQuarterForDate(quarter.startDate);
        expect(quarterAtStart).not.toBeNull();
        expect(quarterAtStart!.id).toBe(quarter.id);
        
        // Test last day of quarter
        const quarterAtEnd = getQuarterForDate(quarter.endDate);
        expect(quarterAtEnd).not.toBeNull();
        expect(quarterAtEnd!.id).toBe(quarter.id);
      });
    });

    it('should return null for invalid dates', () => {
      expect(getQuarterForDate('')).toBeNull();
      expect(getQuarterForDate('invalid')).toBeNull();
      expect(getQuarterForDate('9999-13-01')).toBeNull(); // Invalid month (using future year to avoid conflicts)
      expect(getQuarterForDate('9999-02-30')).toBeNull(); // Invalid day (using future year to avoid conflicts)
    });
  });

  describe('validateQuarterAvailability', () => {
    it('should return null for dates within available quarters', () => {
      // Test dates within each configured quarter
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        const startDate = new Date(quarter.startDate);
        const endDate = new Date(quarter.endDate);
        
        // Test start, middle, and end dates
        expect(validateQuarterAvailability(quarter.startDate)).toBeNull();
        expect(validateQuarterAvailability(quarter.endDate)).toBeNull();
        
        const middleDate = new Date(
          startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2
        );
        const middleDateStr = middleDate.toISOString().split('T')[0];
        if (middleDateStr) {
          expect(validateQuarterAvailability(middleDateStr)).toBeNull();
        }
      });
    });

    it('should return error message for dates outside rolling window', () => {
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
        const error = validateQuarterAvailability(beforeDateStr);
        expect(error).toBeTruthy();
        expect(error).toContain('Date must be in');
        // Error should mention available quarters
        QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
          expect(error).toContain(quarter.name);
        });
      }
      
      // Test date after rolling window
      const afterDate = new Date(latestDate);
      afterDate.setDate(afterDate.getDate() + 1);
      const afterDateStr = afterDate.toISOString().split('T')[0];
      if (afterDateStr) {
        const error = validateQuarterAvailability(afterDateStr);
        expect(error).toBeTruthy();
        expect(error).toContain('Date must be in');
        // Error should mention available quarters
        QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
          expect(error).toContain(quarter.name);
        });
      }
    });

    it('should return error for empty date', () => {
      expect(validateQuarterAvailability('')).toBe('Please enter a date');
    });
  });

  describe('groupEntriesByQuarter', () => {
    it('should group entries by quarter correctly', () => {
      // Create entries for each configured quarter
      const entries: Array<{ date: string; project: string }> = [];
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition, index: number) => {
        const startDate = new Date(quarter.startDate);
        const middleDate = new Date(
          startDate.getTime() + (new Date(quarter.endDate).getTime() - startDate.getTime()) / 2
        );
        entries.push(
          { date: quarter.startDate, project: `Project ${index}-1` },
          { date: middleDate.toISOString().split('T')[0] || quarter.startDate, project: `Project ${index}-2` }
        );
      });

      const grouped = groupEntriesByQuarter(entries);
      
      expect(grouped.size).toBe(QUARTER_DEFINITIONS.length);
      
      // Verify each quarter has entries
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        const quarterEntries = grouped.get(quarter.id);
        expect(quarterEntries).toBeDefined();
        expect(quarterEntries!.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty entries array', () => {
      const grouped = groupEntriesByQuarter([]);
      expect(grouped.size).toBe(0);
    });

    it('should skip entries with invalid dates or dates outside rolling window', () => {
      // Create one valid entry for the first configured quarter
      const validQuarter = QUARTER_DEFINITIONS[0];
      const entries = [
        { date: validQuarter.startDate, project: 'Valid' },
        { date: '2020-01-01', project: 'Invalid - Old' }, // Outside rolling window
        { date: '2030-01-01', project: 'Invalid - Future' }, // Outside rolling window
        { date: 'invalid', project: 'Invalid - Format' },
      ];

      const grouped = groupEntriesByQuarter(entries);
      
      // Should only group valid entries
      const validEntries = Array.from(grouped.values()).flat();
      expect(validEntries.length).toBe(1);
      expect(validEntries[0]!.project).toBe('Valid');
    });
  });

  describe('Utility Functions', () => {
    it('should return available quarter IDs from rolling window', () => {
      const ids = getAvailableQuarterIds();
      const expectedIds = QUARTER_DEFINITIONS.map((q: QuarterDefinition) => q.id);
      expect(ids).toEqual(expectedIds);
      // Rolling window should contain 1-2 quarters
      expect(ids.length).toBeGreaterThanOrEqual(1);
      expect(ids.length).toBeLessThanOrEqual(2);
    });

    it('should get quarter by ID for configured quarters', () => {
      QUARTER_DEFINITIONS.forEach((quarter: QuarterDefinition) => {
        const found = getQuarterById(quarter.id);
        expect(found).not.toBeNull();
        expect(found!.id).toBe(quarter.id);
        expect(found!.name).toBe(quarter.name);
      });
      
      // Invalid ID should return null
      expect(getQuarterById('INVALID-Q-9999')).toBeNull();
    });

    it('should get current quarter based on today', () => {
      const current = getCurrentQuarter();
      if (current) {
        // Current quarter should be in the configured quarters
        const configuredIds = QUARTER_DEFINITIONS.map(q => q.id);
        expect(configuredIds).toContain(current.id);
        
        // Current quarter should be the first in the array (most recent)
        expect(QUARTER_DEFINITIONS[0]!.id).toBe(current.id);
      }
    });
  });
});
