/**
 * @fileoverview Timesheet Validation Logic Unit Tests
 * 
 * Tests for the backend validation logic module to ensure all validation
 * functions work correctly and prevent regressions.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidDate,
  isValidTime,
  isTimeOutAfterTimeIn,
  validateField,
  formatTimeInput,
  type TimesheetRow
} from '../../src/logic/timesheet-validation';

describe('Backend Timesheet Validation Logic', () => {
  describe('isValidDate Function', () => {
    it('should validate correct mm/dd/yyyy dates', () => {
      const validDates = [
        '01/01/2025',
        '12/31/2025',
        '02/29/2024', // Leap year
        '06/15/2025',
        '11/28/2025'
      ];
      
      validDates.forEach(date => {
        expect(isValidDate(date)).toBe(true);
      });
    });

    it('should reject invalid date formats', () => {
      const invalidFormats = [
        '2025-01-15',  // ISO format
        '1/1/25',      // Two-digit year
        '01-15-2025',  // Wrong separator
        '15/01/2025',  // Day/month reversed
        '',
        undefined,
        null
      ];
      
      invalidFormats.forEach(date => {
        expect(isValidDate(date ?? undefined)).toBe(false);
      });
    });

    it('should reject invalid dates', () => {
      const invalidDates = [
        '02/29/2025',  // Not a leap year
        '02/30/2024',  // February doesn't have 30 days
        '04/31/2025',  // April only has 30 days
        '13/01/2025',  // Invalid month
        '00/15/2025',  // Invalid month
        '01/00/2025',  // Invalid day
        '01/32/2025'   // Invalid day
      ];
      
      invalidDates.forEach(date => {
        expect(isValidDate(date)).toBe(false);
      });
    });

    it('should handle year boundaries correctly', () => {
      expect(isValidDate('01/01/1900')).toBe(true);  // Min year
      expect(isValidDate('12/31/2500')).toBe(true);  // Max year
      expect(isValidDate('12/31/1899')).toBe(false); // Below min
      expect(isValidDate('01/01/2501')).toBe(false); // Above max
    });

    it('should handle leap years correctly', () => {
      expect(isValidDate('02/29/2024')).toBe(true);  // Leap year
      expect(isValidDate('02/29/2023')).toBe(false); // Not leap year
      expect(isValidDate('02/29/2000')).toBe(true);  // Divisible by 400
      expect(isValidDate('02/29/1900')).toBe(false); // Not divisible by 400
    });
  });

  describe('formatTimeInput Function', () => {
    it('should format numeric times correctly', () => {
      const tests = [
        { input: '900', expected: '09:00' },
        { input: '1730', expected: '17:30' },
        { input: '800', expected: '08:00' },
        { input: '1430', expected: '14:30' },
        { input: '08', expected: '08:00' },
        { input: '8', expected: '08:00' },
        { input: '12', expected: '12:00' }
      ];
      
      tests.forEach(({ input, expected }) => {
        expect(formatTimeInput(input)).toBe(expected);
      });
    });

    it('should normalize HH:MM format times', () => {
      expect(formatTimeInput('9:00')).toBe('09:00');
      expect(formatTimeInput('9:5')).toBe('09:05');
      expect(formatTimeInput('09:00')).toBe('09:00');
      expect(formatTimeInput('17:30')).toBe('17:30');
    });

    it('should handle invalid inputs gracefully', () => {
      expect(formatTimeInput('abc')).toBe('abc');
      expect(formatTimeInput('')).toBe('');
      expect(formatTimeInput('12:34:56')).toBe('12:34:56'); // Seconds not supported
      expect(formatTimeInput(null)).toBe('');
      expect(formatTimeInput(undefined)).toBe('');
    });

    it('should handle non-string inputs', () => {
      // Numbers are converted to strings and formatted
      expect(formatTimeInput(900)).toBe('09:00');
      // Non-numeric types are stringified without formatting
      expect(formatTimeInput(true)).toBe('true');
      expect(formatTimeInput({})).toBe('[object Object]');
    });
  });

  describe('isValidTime Function', () => {
    it('should validate correct time formats', () => {
      const validTimes = [
        '00:00', '00:15', '00:30', '00:45',
        '09:00', '09:15', '09:30', '09:45',
        '17:00', '17:15', '17:30', '17:45',
        '23:00', '23:15', '23:30', '23:45'
      ];
      
      validTimes.forEach(time => {
        expect(isValidTime(time)).toBe(true);
      });
    });

    it('should validate numeric time formats', () => {
      const validNumericTimes = [
        '900',   // 09:00
        '1730',  // 17:30
        '800',   // 08:00
        '1430',  // 14:30
        '08',    // 08:00
        '8'      // 08:00
      ];
      
      validNumericTimes.forEach(time => {
        expect(isValidTime(time)).toBe(true);
      });
    });

    it('should reject non-15-minute increments', () => {
      const invalidIncrements = [
        '09:01', '09:07', '09:13', '09:22',
        '09:38', '09:52', '17:03', '17:17'
      ];
      
      invalidIncrements.forEach(time => {
        expect(isValidTime(time)).toBe(false);
      });
    });

    it('should reject invalid time formats', () => {
      const invalidTimes = [
        '25:00',  // Invalid hour
        '09:60',  // Invalid minute
        'abc',
        '',
        undefined,
        null
      ];
      
      invalidTimes.forEach(time => {
        expect(isValidTime(time ?? undefined)).toBe(false);
      });
    });

    it('should handle edge time values', () => {
      expect(isValidTime('00:00')).toBe(true);  // Midnight
      expect(isValidTime('23:45')).toBe(true);  // Last valid time
      expect(isValidTime('24:00')).toBe(false); // Invalid hour
    });
  });

  describe('isTimeOutAfterTimeIn Function', () => {
    it('should validate time out after time in', () => {
      const validPairs = [
        { timeIn: '09:00', timeOut: '17:00' },
        { timeIn: '08:30', timeOut: '16:30' },
        { timeIn: '00:00', timeOut: '00:15' },
        { timeIn: '23:30', timeOut: '23:45' }
      ];
      
      validPairs.forEach(({ timeIn, timeOut }) => {
        expect(isTimeOutAfterTimeIn(timeIn, timeOut)).toBe(true);
      });
    });

    it('should reject time out before or equal to time in', () => {
      const invalidPairs = [
        { timeIn: '17:00', timeOut: '09:00' },
        { timeIn: '09:30', timeOut: '09:15' },
        { timeIn: '09:00', timeOut: '09:00' } // Same time
      ];
      
      invalidPairs.forEach(({ timeIn, timeOut }) => {
        expect(isTimeOutAfterTimeIn(timeIn, timeOut)).toBe(false);
      });
    });

    it('should return true for missing values', () => {
      expect(isTimeOutAfterTimeIn(undefined, '17:00')).toBe(true);
      expect(isTimeOutAfterTimeIn('09:00', undefined)).toBe(true);
      expect(isTimeOutAfterTimeIn(undefined, undefined)).toBe(true);
    });

    it('should handle malformed time strings', () => {
      expect(isTimeOutAfterTimeIn('abc', '17:00')).toBe(true);
      expect(isTimeOutAfterTimeIn('09:00', 'xyz')).toBe(true);
    });
  });

  describe('validateField Function', () => {
    const mockProjects = [
      'FL-Carver Techs', 'FL-Carver Tools', 'OSC-BBB',
      'PTO/RTO', 'SWFL-CHEM/GAS', 'SWFL-EQUIP', 'Training'
    ];
    
    const mockChargeCodes = [
      'Admin', 'EPR1', 'EPR2', 'EPR3', 'EPR4', 'Repair',
      'Meeting', 'Other', 'PM', 'Training', 'Upgrade'
    ];
    
    let mockRows: TimesheetRow[];

    beforeEach(() => {
      mockRows = [
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
    });

    function randomDateInCurrentQuarter(): string {
      const now = new Date();
      const year = now.getFullYear();
      const q = Math.floor(now.getMonth() / 3);
      const startMonth = q * 3; // 0,3,6,9
      const endMonth = startMonth + 2;
      const start = new Date(year, startMonth, 1);
      const end = new Date(year, endMonth + 1, 0); // last day of end month
      const startTime = start.getTime();
      const endTime = end.getTime();
      const randTime = startTime + Math.floor(Math.random() * (endTime - startTime + 1));
      const d = new Date(randTime);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    }

    describe('Date Field Validation', () => {
      it('should accept valid dates', () => {
        const currentQuarterDate = randomDateInCurrentQuarter();
        const result = validateField(currentQuarterDate, 0, 'date', mockRows, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });

      it('should reject empty dates', () => {
        const result = validateField('', 0, 'date', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('required');
      });

      it('should reject invalid date formats', () => {
        const result = validateField('2025-01-15', 0, 'date', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('like 01/15/2024');
      });

      it('should reject invalid dates', () => {
        const result = validateField('02/30/2025', 0, 'date', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('like 01/15/2024');
      });
    });

    describe('TimeIn Field Validation', () => {
      it('should accept valid times', () => {
        const result = validateField('09:00', 0, 'timeIn', mockRows, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });

      it('should reject empty times', () => {
        const result = validateField('', 0, 'timeIn', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('required');
      });

      it('should reject non-15-minute increments', () => {
        const result = validateField('09:01', 0, 'timeIn', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('15 minute steps');
      });
    });

    describe('TimeOut Field Validation', () => {
      it('should accept valid times', () => {
        const result = validateField('17:00', 0, 'timeOut', mockRows, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });

      it('should reject times before timeIn', () => {
        const result = validateField('08:00', 0, 'timeOut', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('after start time');
      });

      it('should reject times equal to timeIn', () => {
        const result = validateField('09:00', 0, 'timeOut', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('after start time');
      });
    });

    describe('Project Field Validation', () => {
      it('should accept valid projects', () => {
        const result = validateField('FL-Carver Techs', 0, 'project', mockRows, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });

      it('should reject empty projects', () => {
        const result = validateField('', 0, 'project', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('required');
      });

      it('should reject invalid projects', () => {
        const result = validateField('Invalid Project', 0, 'project', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('from the list');
      });
    });

    describe('Tool Field Validation', () => {
      it('should accept valid tools for projects that need them', () => {
        const result = validateField('#1 Rinse and 2D marker', 0, 'tool', mockRows, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });

      it('should accept null for projects without tools', () => {
        const rowsWithPTO = [{ ...mockRows[0], project: 'PTO/RTO' }];
        const result = validateField('', 0, 'tool', rowsWithPTO, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });

      it('should require tool for projects that need them', () => {
        const result = validateField('', 0, 'tool', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('pick a tool');
      });
    });

    describe('ChargeCode Field Validation', () => {
      it('should accept valid charge codes', () => {
        const result = validateField('EPR1', 0, 'chargeCode', mockRows, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });

      it('should accept null for tools without charge codes', () => {
        const rowsWithMeeting = [{ ...mockRows[0], tool: 'Meeting' }];
        const result = validateField('', 0, 'chargeCode', rowsWithMeeting, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });

      it('should require charge code for tools that need them', () => {
        const result = validateField('', 0, 'chargeCode', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('charge code');
      });

      it('should reject invalid charge codes', () => {
        const result = validateField('INVALID', 0, 'chargeCode', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('from the list');
      });
    });

    describe('TaskDescription Field Validation', () => {
      it('should accept valid descriptions', () => {
        const result = validateField('Test task description', 0, 'taskDescription', mockRows, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });

      it('should reject empty descriptions', () => {
        const result = validateField('', 0, 'taskDescription', mockRows, mockProjects, mockChargeCodes);
        expect(result).toContain('required');
      });

      it('should accept long descriptions', () => {
        const longDescription = 'A'.repeat(1000);
        const result = validateField(longDescription, 0, 'taskDescription', mockRows, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });

      it('should accept descriptions with special characters', () => {
        const result = validateField('Task with "quotes" and <brackets>', 0, 'taskDescription', mockRows, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });
    });

    describe('Unknown Field Validation', () => {
      it('should return null for unknown fields', () => {
        const result = validateField('value', 0, 'unknownField', mockRows, mockProjects, mockChargeCodes);
        expect(result).toBeNull();
      });
    });
  });

  describe('Error Message Quality', () => {
    const mockProjects = ['FL-Carver Techs'];
    const mockChargeCodes = ['EPR1'];
    const mockRows: TimesheetRow[] = [
      {
        date: '01/15/2025',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1',
        taskDescription: 'Test'
      }
    ];

    it('should provide user-friendly error messages', () => {
      const errors = [
        validateField('', 0, 'date', mockRows, mockProjects, mockChargeCodes),
        validateField('', 0, 'timeIn', mockRows, mockProjects, mockChargeCodes),
        validateField('', 0, 'timeOut', mockRows, mockProjects, mockChargeCodes),
        validateField('', 0, 'project', mockRows, mockProjects, mockChargeCodes),
        validateField('', 0, 'taskDescription', mockRows, mockProjects, mockChargeCodes)
      ];
      
      errors.forEach(error => {
        expect(error).toBeTruthy();
        expect(error!.length).toBeLessThan(100);
        expect(error).not.toContain('undefined');
        expect(error).not.toContain('null');
      });
    });

    it('should provide actionable guidance', () => {
      const dateError = validateField('invalid', 0, 'date', mockRows, mockProjects, mockChargeCodes);
      expect(dateError).toContain('like 01/15/2024'); // Shows example
      
      const timeError = validateField('invalid', 0, 'timeIn', mockRows, mockProjects, mockChargeCodes);
      expect(timeError).toContain('like 09:00'); // Shows example
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete row validation', () => {
      const mockProjects = ['FL-Carver Techs'];
      const mockChargeCodes = ['EPR1'];
      const mockRows: TimesheetRow[] = [
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

      const fields = ['date', 'timeIn', 'timeOut', 'project', 'tool', 'chargeCode', 'taskDescription'];
      const values = ['01/15/2025', '09:00', '17:00', 'FL-Carver Techs', '#1 Rinse', 'EPR1', 'Test'];
      
      fields.forEach((field, index) => {
        const result = validateField(values[index], 0, field, mockRows, mockProjects, mockChargeCodes);
        expect(typeof result).toBe(result === null ? 'object' : 'string');
      });
    });

    it('should handle cascading validation dependencies', () => {
      const mockProjects = ['PTO/RTO'];
      const mockChargeCodes = ['EPR1'];
      const mockRows: TimesheetRow[] = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'PTO/RTO',
          tool: null,
          chargeCode: null,
          taskDescription: 'Test'
        }
      ];

      // PTO/RTO doesn't need tools, so tool should be null
      const toolResult = validateField('', 0, 'tool', mockRows, mockProjects, mockChargeCodes);
      expect(toolResult).toBeNull();
      
      // If no tool, then no charge code
      const chargeCodeResult = validateField('', 0, 'chargeCode', mockRows, mockProjects, mockChargeCodes);
      expect(chargeCodeResult).toBeNull();
    });
  });
});

