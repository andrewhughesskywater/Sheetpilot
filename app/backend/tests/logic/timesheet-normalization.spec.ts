/**
 * @fileoverview Timesheet Normalization Logic Unit Tests
 * 
 * Tests for the backend normalization logic to ensure data transformation
 * follows business rules and prevents regressions.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRowData,
  normalizeTrailingBlank,
  type TimesheetRow
} from '../../src/logic/timesheet-normalization';

describe('Backend Timesheet Normalization Logic', () => {
  describe('normalizeRowData Function', () => {
    it('should clear tool and charge code for projects without tools', () => {
      const projectsWithoutTools = ['ERT', 'PTO/RTO', 'SWFL-CHEM/GAS', 'Training'];
      
      projectsWithoutTools.forEach(project => {
        const row: TimesheetRow = {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: project,
          tool: 'Some Tool',
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        };
        
        const normalized = normalizeRowData(row);
        expect(normalized.tool).toBeNull();
        expect(normalized.chargeCode).toBeNull();
        expect(normalized.project).toBe(project);
        expect(normalized.date).toBe(row.date);
        expect(normalized.taskDescription).toBe(row.taskDescription);
      });
    });

    it('should preserve tool for projects that need tools', () => {
      const projectsWithTools = ['FL-Carver Techs', 'FL-Carver Tools', 'OSC-BBB', 'SWFL-EQUIP'];
      
      projectsWithTools.forEach(project => {
        const row: TimesheetRow = {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: project,
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        };
        
        const normalized = normalizeRowData(row);
        expect(normalized.tool).toBe('#1 Rinse and 2D marker');
        expect(normalized.chargeCode).toBe('EPR1');
      });
    });

    it('should clear charge code for tools without charges', () => {
      const toolsWithoutCharges = [
        'Internal Meeting', 'DECA Meeting', 'Logistics', 'Meeting',
        'Non Tool Related', 'Admin', 'Training', 'N/A'
      ];
      
      toolsWithoutCharges.forEach(tool => {
        const row: TimesheetRow = {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'FL-Carver Techs',
          tool: tool,
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        };
        
        const normalized = normalizeRowData(row);
        expect(normalized.tool).toBe(tool);
        expect(normalized.chargeCode).toBeNull();
      });
    });

    it('should preserve charge code for tools that need it', () => {
      const toolsWithCharges = [
        '#1 Rinse and 2D marker', '#2 Sputter', 'AFM101', 'ALD101'
      ];
      
      toolsWithCharges.forEach(tool => {
        const row: TimesheetRow = {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'FL-Carver Techs',
          tool: tool,
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        };
        
        const normalized = normalizeRowData(row);
        expect(normalized.tool).toBe(tool);
        expect(normalized.chargeCode).toBe('EPR1');
      });
    });

    it('should handle null values', () => {
      const row: TimesheetRow = {
        date: '01/15/2025',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'FL-Carver Techs',
        tool: null,
        chargeCode: null,
        taskDescription: 'Test task'
      };
      
      const normalized = normalizeRowData(row);
      expect(normalized.tool).toBeNull();
      expect(normalized.chargeCode).toBeNull();
    });

    it('should handle undefined values', () => {
      const row: TimesheetRow = {
        date: '01/15/2025',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'FL-Carver Techs',
        taskDescription: 'Test task'
      };
      
      const normalized = normalizeRowData(row);
      expect(normalized.tool).toBeUndefined();
      expect(normalized.chargeCode).toBeNull();
    });

    it('should not modify other fields', () => {
      const row: TimesheetRow = {
        id: 123,
        date: '01/15/2025',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1',
        taskDescription: 'Test task'
      };
      
      const normalized = normalizeRowData(row);
      expect(normalized.id).toBe(123);
      expect(normalized.date).toBe('01/15/2025');
      expect(normalized.timeIn).toBe('09:00');
      expect(normalized.timeOut).toBe('17:00');
      expect(normalized.project).toBe('FL-Carver Techs');
      expect(normalized.taskDescription).toBe('Test task');
    });

    it('should create a new object (not mutate original)', () => {
      const row: TimesheetRow = {
        date: '01/15/2025',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'PTO/RTO',
        tool: 'Some Tool',
        chargeCode: 'EPR1',
        taskDescription: 'Test task'
      };
      
      const normalized = normalizeRowData(row);
      
      // Normalized should have null tool/chargeCode
      expect(normalized.tool).toBeNull();
      expect(normalized.chargeCode).toBeNull();
      
      // Original should be unchanged
      expect(row.tool).toBe('Some Tool');
      expect(row.chargeCode).toBe('EPR1');
    });

    it('should handle empty objects', () => {
      const row: TimesheetRow = {};
      const normalized = normalizeRowData(row);
      expect(normalized).toEqual({});
    });

    it('should handle partial data', () => {
      const row: TimesheetRow = {
        project: 'PTO/RTO',
        tool: 'Some Tool'
      };
      
      const normalized = normalizeRowData(row);
      expect(normalized.project).toBe('PTO/RTO');
      expect(normalized.tool).toBeNull();
      expect(normalized.chargeCode).toBeNull();
    });
  });

  describe('normalizeTrailingBlank Function', () => {
    it('should add one blank row to non-empty data', () => {
      const rows: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        }
      ];
      
      const normalized = normalizeTrailingBlank(rows);
      expect(normalized.length).toBe(2);
      expect(normalized[0]).toEqual(rows[0]);
      expect(normalized[1]).toEqual({});
    });

    it('should remove multiple trailing blank rows', () => {
      const rows: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        },
        {},
        {},
        {}
      ];
      
      const normalized = normalizeTrailingBlank(rows);
      expect(normalized.length).toBe(2);
      expect(normalized[0]).toEqual(rows[0]);
      expect(normalized[1]).toEqual({});
    });

    it('should return one blank row for empty array', () => {
      const rows: TimesheetRow[] = [];
      const normalized = normalizeTrailingBlank(rows);
      expect(normalized.length).toBe(1);
      expect(normalized[0]).toBeUndefined();
    });

    it('should return one blank row for all blank rows', () => {
      const rows: TimesheetRow[] = [{}, {}, {}];
      const normalized = normalizeTrailingBlank(rows);
      expect(normalized.length).toBe(1);
      expect(normalized[0]).toEqual({});
    });

    it('should handle rows with partial data', () => {
      const rows: TimesheetRow[] = [
        {
          date: '01/15/2025',
          project: 'FL-Carver Techs'
        },
        {
          timeIn: '09:00' // Has data
        },
        {},
        {}
      ];
      
      const normalized = normalizeTrailingBlank(rows);
      expect(normalized.length).toBe(3); // Two rows with data + one blank
      expect(normalized[0]).toEqual(rows[0]);
      expect(normalized[1]).toEqual(rows[1]);
      expect(normalized[2]).toEqual({});
    });

    it('should consider any field as non-empty', () => {
      const tests = [
        { rows: [{ date: '01/15/2025' }, {}], expectedLength: 2 },
        { rows: [{ timeIn: '09:00' }, {}], expectedLength: 2 },
        { rows: [{ timeOut: '17:00' }, {}], expectedLength: 2 },
        { rows: [{ project: 'Test' }, {}], expectedLength: 2 },
        { rows: [{ tool: 'Tool' }, {}], expectedLength: 2 },
        { rows: [{ chargeCode: 'EPR1' }, {}], expectedLength: 2 },
        { rows: [{ taskDescription: 'Task' }, {}], expectedLength: 2 }
      ];
      
      tests.forEach(({ rows, expectedLength }) => {
        const normalized = normalizeTrailingBlank(rows);
        expect(normalized.length).toBe(expectedLength);
      });
    });

    it('should not modify input array', () => {
      const rows: TimesheetRow[] = [
        {
          date: '01/15/2025',
          project: 'Test'
        },
        {},
        {}
      ];
      
      const originalLength = rows.length;
      normalizeTrailingBlank(rows);
      
      // Original array should be unchanged
      expect(rows.length).toBe(originalLength);
    });

    it('should handle very long arrays efficiently', () => {
      const rows: TimesheetRow[] = Array(1000).fill({});
      rows[0] = { date: '01/15/2025' };
      
      const startTime = Date.now();
      const normalized = normalizeTrailingBlank(rows);
      const duration = Date.now() - startTime;
      
      expect(normalized.length).toBe(2);
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe('Integration Tests', () => {
    it('should normalize multiple rows correctly', () => {
      const rows: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'PTO/RTO',
          tool: 'Invalid Tool',
          chargeCode: 'Invalid Code',
          taskDescription: 'PTO day'
        },
        {
          date: '01/16/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'FL-Carver Techs',
          tool: 'Meeting',
          chargeCode: 'Should be removed',
          taskDescription: 'Team meeting'
        },
        {
          date: '01/17/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Equipment work'
        }
      ];
      
      const normalized = rows.map(row => normalizeRowData(row));
      
      // Row 0: PTO/RTO should clear tool and charge code
      expect(normalized[0].tool).toBeNull();
      expect(normalized[0].chargeCode).toBeNull();
      
      // Row 1: Meeting doesn't need charge code
      expect(normalized[1].tool).toBe('Meeting');
      expect(normalized[1].chargeCode).toBeNull();
      
      // Row 2: Valid tool and charge code should be preserved
      expect(normalized[2].tool).toBe('#1 Rinse and 2D marker');
      expect(normalized[2].chargeCode).toBe('EPR1');
    });

    it('should handle complete workflow: normalize data + normalize trailing blanks', () => {
      const rows: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'PTO/RTO',
          tool: 'Invalid',
          chargeCode: 'Invalid',
          taskDescription: 'Test'
        },
        {},
        {},
        {}
      ];
      
      // Step 1: Normalize each row's data
      const normalizedData = rows.map(row => normalizeRowData(row));
      
      // Step 2: Normalize trailing blanks
      const finalResult = normalizeTrailingBlank(normalizedData);
      
      expect(finalResult.length).toBe(2);
      expect(finalResult[0].tool).toBeNull();
      expect(finalResult[0].chargeCode).toBeNull();
      expect(finalResult[1]).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle rows with undefined properties', () => {
      const row: TimesheetRow = {
        project: undefined,
        tool: undefined,
        chargeCode: undefined
      };
      
      const normalized = normalizeRowData(row);
      expect(normalized.tool).toBeUndefined();
      expect(normalized.chargeCode).toBeNull();
    });

    it('should handle rows with empty strings', () => {
      const row: TimesheetRow = {
        date: '',
        timeIn: '',
        timeOut: '',
        project: '',
        tool: '',
        chargeCode: '',
        taskDescription: ''
      };
      
      const normalized = normalizeRowData(row);
      // Empty string for project means no tools needed
      expect(normalized.chargeCode).toBeNull();
    });

    it('should handle very large datasets', () => {
      const rows: TimesheetRow[] = Array(10000).fill({
        date: '01/15/2025',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1',
        taskDescription: 'Test'
      });
      
      const startTime = Date.now();
      const normalized = rows.map(row => normalizeRowData(row));
      const duration = Date.now() - startTime;
      
      expect(normalized.length).toBe(10000);
      expect(duration).toBeLessThan(1000); // Should be reasonably fast
    });

    it('should handle mixed null and undefined values', () => {
      const row: TimesheetRow = {
        date: '01/15/2025',
        project: 'PTO/RTO',
        tool: null,
        chargeCode: undefined
      };
      
      const normalized = normalizeRowData(row);
      expect(normalized.tool).toBeNull();
      expect(normalized.chargeCode).toBeNull();
    });
  });
});

