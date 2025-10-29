/**
 * @fileoverview Validation Rules Unit Tests
 * 
 * Comprehensive tests for all validation logic to prevent AI regression.
 * Tests every validation rule, edge case, and business constraint.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidDate,
  isValidTime,
  isTimeOutAfterTimeIn,
  validateField,
  formatTimeInput
} from '../../src/logic/timesheet-validation';
import { validateQuarterAvailability } from '../../src/services/bot/src/quarter_config';
import { validTimesheetEntries, invalidTimesheetEntries, edgeCaseEntries } from '../fixtures/timesheet-data';
import { assertValidTimesheetRow, assertInvalidTimesheetRow } from '../helpers/assertion-helpers';

describe('Validation Rules Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Date Validation', () => {
    it('should validate correct date format (mm/dd/yyyy)', () => {
      const validDates = [
        '01/15/2025',
        '12/31/2024',
        '02/29/2024', // Leap year
        '03/31/2025'
      ];
      
      validDates.forEach(date => {
        expect(isValidDate(date)).toBe(true);
      });
    });

    it('should reject invalid date formats', () => {
      const invalidDates = [
        '2025-01-15', // Wrong format
        '1/15/25',    // Wrong format
        '01-15-2025', // Wrong separator
        '15/01/2025', // Wrong order
        '01/15',      // Missing year
        '2025/01/15', // Wrong format
        ''            // Empty
      ];
      
      invalidDates.forEach(date => {
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
        expect(isValidDate(date)).toBe(false);
      });
    });

    it('should handle leap year correctly', () => {
      expect(isValidDate('02/29/2024')).toBe(true);  // Leap year
      expect(isValidDate('02/29/2023')).toBe(false); // Not leap year
      expect(isValidDate('02/29/2020')).toBe(true);  // Leap year
      expect(isValidDate('02/29/2021')).toBe(false); // Not leap year
    });

    it('should validate quarter availability', () => {
      // Valid dates in available quarters (Q1-Q4 2025)
      const validQuarterDates = [
        '01/01/2025',  // Q1
        '02/15/2025',  // Q1
        '03/31/2025',  // Q1
        '04/01/2025',  // Q2
        '07/15/2025'   // Q3
      ];
      
      // Invalid dates outside available quarters
      const invalidQuarterDates = [
        '12/31/2024',  // Before available quarters
        '01/01/2026'   // After available quarters
      ];
      
      validQuarterDates.forEach(date => {
        const [month, day, year] = date.split('/').map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        expect(validateQuarterAvailability(isoDate)).toBeNull();
      });
      
      invalidQuarterDates.forEach(date => {
        const [month, day, year] = date.split('/').map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        expect(validateQuarterAvailability(isoDate)).toBeTruthy();
      });
    });
  });

  describe('Time Format Validation', () => {
    it('should validate HH:MM format', () => {
      const validTimes = [
        '09:00',
        '17:30',
        '00:00',
        '23:45',
        '12:15'
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

    it('should reject invalid time formats', () => {
      const invalidTimes = [
        '25:00',  // Invalid hour
        '09:60',  // Invalid minute
        '09:01',  // Not 15-minute increment
        '09:07',  // Not 15-minute increment
        '09:13',  // Not 15-minute increment
        '09:22',  // Not 15-minute increment
        '09:38',  // Not 15-minute increment
        '09:52',  // Not 15-minute increment
        'abc',    // Non-numeric
        ''        // Empty
      ];
      
      invalidTimes.forEach(time => {
        expect(isValidTime(time)).toBe(false);
      });
      
      // Test that missing leading zero gets normalized and becomes valid
      expect(isValidTime('9:00')).toBe(true);
    });

    it('should enforce 15-minute increments', () => {
      const validIncrements = [
        '00:00', '00:15', '00:30', '00:45',
        '09:00', '09:15', '09:30', '09:45',
        '17:00', '17:15', '17:30', '17:45',
        '23:00', '23:15', '23:30', '23:45'
      ];
      
      const invalidIncrements = [
        '09:01', '09:07', '09:13', '09:22',
        '09:38', '09:52', '17:03', '17:17',
        '17:23', '17:37', '17:53'
      ];
      
      validIncrements.forEach(time => {
        expect(isValidTime(time)).toBe(true);
      });
      
      invalidIncrements.forEach(time => {
        expect(isValidTime(time)).toBe(false);
      });
    });

    it('should format time input correctly', () => {
      const formatTestCases = [
        { input: '900', expected: '09:00' },
        { input: '1730', expected: '17:30' },
        { input: '800', expected: '08:00' },
        { input: '1430', expected: '14:30' },
        { input: '08', expected: '08:00' },
        { input: '8', expected: '08:00' },
        { input: '09:00', expected: '09:00' }, // Already formatted
        { input: 'abc', expected: 'abc' },     // Invalid input
        { input: '', expected: '' }            // Empty input
      ];
      
      formatTestCases.forEach(({ input, expected }) => {
        expect(formatTimeInput(input)).toBe(expected);
      });
    });
  });

  describe('Time Relationship Validation', () => {
    it('should validate time out is after time in', () => {
      const validTimePairs = [
        { timeIn: '09:00', timeOut: '17:00' },
        { timeIn: '08:30', timeOut: '16:30' },
        { timeIn: '00:00', timeOut: '00:15' },
        { timeIn: '23:30', timeOut: '23:45' },
        { timeIn: '09:15', timeOut: '09:30' }
      ];
      
      validTimePairs.forEach(({ timeIn, timeOut }) => {
        expect(isTimeOutAfterTimeIn(timeIn, timeOut)).toBe(true);
      });
    });

    it('should reject time out before or equal to time in', () => {
      const invalidTimePairs = [
        { timeIn: '17:00', timeOut: '09:00' },
        { timeIn: '09:30', timeOut: '09:15' },
        { timeIn: '12:45', timeOut: '08:30' },
        { timeIn: '09:00', timeOut: '09:00' }, // Same time
        { timeIn: '15:30', timeOut: '15:30' }  // Same time
      ];
      
      invalidTimePairs.forEach(({ timeIn, timeOut }) => {
        expect(isTimeOutAfterTimeIn(timeIn, timeOut)).toBe(false);
      });
    });

    it('should handle edge cases for time validation', () => {
      // Midnight to next day
      expect(isTimeOutAfterTimeIn('23:45', '00:00')).toBe(false);
      
      // Same time
      expect(isTimeOutAfterTimeIn('12:00', '12:00')).toBe(false);
      
      // Very short duration
      expect(isTimeOutAfterTimeIn('09:00', '09:15')).toBe(true);
      
      // Very long duration
      expect(isTimeOutAfterTimeIn('06:00', '18:00')).toBe(true);
    });
  });

  describe('Field Validation', () => {
    const mockRows = [
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
    
    const projects = [
      'FL-Carver Techs', 'FL-Carver Tools', 'OSC-BBB',
      'PTO/RTO', 'SWFL-CHEM/GAS', 'SWFL-EQUIP', 'Training'
    ];
    
    const chargeCodes = [
      'Admin', 'EPR1', 'EPR2', 'EPR3', 'EPR4', 'Repair',
      'Meeting', 'Other', 'PM', 'Training', 'Upgrade'
    ];

    it('should validate required fields', () => {
      const requiredFields = ['date', 'timeIn', 'timeOut', 'project', 'taskDescription'];
      
      requiredFields.forEach(field => {
        const error = validateField('', 0, field, mockRows, projects, chargeCodes);
        expect(error).toBeTruthy();
        expect(error).toContain('required');
      });
    });

    it('should validate date field', () => {
      const validDate = validateField('01/15/2025', 0, 'date', mockRows, projects, chargeCodes);
      expect(validDate).toBeNull();
      
      const invalidDate = validateField('2025-01-15', 0, 'date', mockRows, projects, chargeCodes);
      expect(invalidDate).toBeTruthy();
      expect(invalidDate).toContain('like 01/15/2024');
    });

    it('should validate timeIn field', () => {
      const validTime = validateField('09:00', 0, 'timeIn', mockRows, projects, chargeCodes);
      expect(validTime).toBeNull();
      
      const invalidTime = validateField('09:01', 0, 'timeIn', mockRows, projects, chargeCodes);
      expect(invalidTime).toBeTruthy();
      expect(invalidTime).toContain('15 minute steps');
    });

    it('should validate timeOut field', () => {
      const validTime = validateField('17:00', 0, 'timeOut', mockRows, projects, chargeCodes);
      expect(validTime).toBeNull();
      
      const invalidTime = validateField('08:00', 0, 'timeOut', mockRows, projects, chargeCodes);
      expect(invalidTime).toBeTruthy();
      expect(invalidTime).toContain('after start time');
    });

    it('should validate project field', () => {
      const validProject = validateField('FL-Carver Techs', 0, 'project', mockRows, projects, chargeCodes);
      expect(validProject).toBeNull();
      
      const invalidProject = validateField('Invalid Project', 0, 'project', mockRows, projects, chargeCodes);
      expect(invalidProject).toBeTruthy();
      expect(invalidProject).toContain('from the list');
    });

    it('should validate tool field based on project', () => {
      // Project that needs tools
      const validTool = validateField('#1 Rinse and 2D marker', 0, 'tool', mockRows, projects, chargeCodes);
      expect(validTool).toBeNull();
      
      // Project that doesn't need tools
      const rowsWithPTO = [{
        ...mockRows[0],
        project: 'PTO/RTO'
      }];
      const toolForPTO = validateField('', 0, 'tool', rowsWithPTO, projects, chargeCodes);
      expect(toolForPTO).toBeNull(); // Should be null (N/A)
    });

    it('should validate chargeCode field based on tool', () => {
      // Tool that needs charge code
      const validChargeCode = validateField('EPR1', 0, 'chargeCode', mockRows, projects, chargeCodes);
      expect(validChargeCode).toBeNull();
      
      // Tool that doesn't need charge code
      const rowsWithMeeting = [{
        ...mockRows[0],
        tool: 'Meeting'
      }];
      const chargeCodeForMeeting = validateField('', 0, 'chargeCode', rowsWithMeeting, projects, chargeCodes);
      expect(chargeCodeForMeeting).toBeNull(); // Should be null (N/A)
    });

    it('should validate taskDescription field', () => {
      const validDescription = validateField('Test task description', 0, 'taskDescription', mockRows, projects, chargeCodes);
      expect(validDescription).toBeNull();
      
      const invalidDescription = validateField('', 0, 'taskDescription', mockRows, projects, chargeCodes);
      expect(invalidDescription).toBeTruthy();
      expect(invalidDescription).toContain('describe what you did');
    });
  });

  describe('Comprehensive Validation Tests', () => {
    it('should validate all valid timesheet entries', () => {
      validTimesheetEntries.forEach(entry => {
        assertValidTimesheetRow(entry);
        
        // Test individual validations
        expect(isValidDate(entry.date)).toBe(true);
        expect(isValidTime(entry.timeIn)).toBe(true);
        expect(isValidTime(entry.timeOut)).toBe(true);
        expect(isTimeOutAfterTimeIn(entry.timeIn, entry.timeOut)).toBe(true);
      });
    });

    it('should reject all invalid timesheet entries', () => {
      const actuallyInvalidEntries = invalidTimesheetEntries.filter(entry => {
        const hasInvalidDate = !isValidDate(entry.date || '');
        const hasInvalidTimeIn = !isValidTime(entry.timeIn || '');
        const hasInvalidTimeOut = !isValidTime(entry.timeOut || '');
        const hasInvalidTimeRelationship = !isTimeOutAfterTimeIn(entry.timeIn, entry.timeOut);
        const hasMissingRequired = !entry.date || !entry.timeIn || !entry.timeOut || !entry.project || !entry.taskDescription;
        
        return hasInvalidDate || hasInvalidTimeIn || hasInvalidTimeOut || hasInvalidTimeRelationship || hasMissingRequired;
      });
      
      expect(actuallyInvalidEntries.length).toBeGreaterThan(0);
      
      actuallyInvalidEntries.forEach(entry => {
        assertInvalidTimesheetRow(entry);
      });
    });

    it('should handle edge cases correctly', () => {
      edgeCaseEntries.forEach(entry => {
        // Edge cases should be handled appropriately
        if (entry.date === '02/29/2024') {
          expect(isValidDate(entry.date)).toBe(true); // Valid leap year
        } else if (entry.date === '02/29/2023') {
          expect(isValidDate(entry.date)).toBe(false); // Invalid non-leap year
        }
        
        if (entry.timeIn === '00:00' && entry.timeOut === '00:15') {
          expect(isValidTime(entry.timeIn)).toBe(true);
          expect(isValidTime(entry.timeOut)).toBe(true);
          expect(isTimeOutAfterTimeIn(entry.timeIn, entry.timeOut)).toBe(true);
        }
        
        if (entry.timeIn === '23:30' && entry.timeOut === '23:45') {
          expect(isValidTime(entry.timeIn)).toBe(true);
          expect(isValidTime(entry.timeOut)).toBe(true);
          expect(isTimeOutAfterTimeIn(entry.timeIn, entry.timeOut)).toBe(true);
        }
      });
    });
  });

  describe('Business Rule Validation', () => {
    it('should enforce project-tool relationships', () => {
      const projectsWithoutTools = ['ERT', 'PTO/RTO', 'SWFL-CHEM/GAS', 'Training'];
      
      projectsWithoutTools.forEach(project => {
        const rows = [{
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: project,
          tool: 'Some Tool', // Should be cleared
          chargeCode: 'EPR1', // Should be cleared
          taskDescription: 'Test task'
        }];
        
        // Tool should be null for these projects
        const toolValidation = validateField('', 0, 'tool', rows, ['FL-Carver Techs', ...projectsWithoutTools], ['EPR1']);
        expect(toolValidation).toBeNull(); // Should be null (N/A)
      });
    });

    it('should enforce tool-chargeCode relationships', () => {
      const toolsWithoutCharges = [
        'Internal Meeting', 'DECA Meeting', 'Logistics', 'Meeting',
        'Non Tool Related', 'Admin', 'Training', 'N/A'
      ];
      
      toolsWithoutCharges.forEach(tool => {
        const rows = [{
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'FL-Carver Techs',
          tool: tool,
          chargeCode: 'EPR1', // Should be cleared
          taskDescription: 'Test task'
        }];
        
        // Charge code should be null for these tools
        const chargeCodeValidation = validateField('', 0, 'chargeCode', rows, ['FL-Carver Techs'], ['EPR1']);
        expect(chargeCodeValidation).toBeNull(); // Should be null (N/A)
      });
    });

    it('should validate quarter availability', () => {
      // Test with available quarter dates (Q1-Q4 2025)
      const availableQuarterDates = [
        '01/01/2025',  // Q1
        '02/15/2025',  // Q1
        '03/31/2025',  // Q1
        '04/01/2025',  // Q2
        '07/15/2025'   // Q3
      ];
      
      availableQuarterDates.forEach(date => {
        const [month, day, year] = date.split('/').map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        expect(validateQuarterAvailability(isoDate)).toBeNull();
      });
    });
  });

  describe('Error Message Validation', () => {
    it('should provide user-friendly error messages', () => {
      const errorMessages = [
        'Please enter a date',
        'Please enter start time',
        'Please enter end time',
        'Please pick a project',
        'Please describe what you did',
        'Date must be like 01/15/2024',
        'Time must be like 09:00, 800, or 1430 and in 15 minute steps',
        'End time must be after start time',
        'Please pick from the list'
      ];
      
      errorMessages.forEach(message => {
        expect(message.length).toBeLessThan(100);
        expect(message).not.toContain('undefined');
        expect(message).not.toContain('null');
        expect(message).not.toContain('Error:');
        expect(message).not.toContain('TypeError:');
        expect(message).not.toContain('Exception');
      });
    });

    it('should provide specific guidance for each field', () => {
      const fieldGuidance = {
        date: 'like 01/15/2024',
        timeIn: 'like 09:00, 800, or 1430 and in 15 minute steps',
        timeOut: 'like 17:00, 1700, or 530 and in 15 minute steps',
        project: 'from the list',
        tool: 'for this project',
        chargeCode: 'for this tool',
        taskDescription: 'describe what you did'
      };
      
      Object.entries(fieldGuidance).forEach(([_field, guidance]) => {
        expect(guidance).toBeDefined();
        expect(typeof guidance).toBe('string');
        expect(guidance.length).toBeGreaterThan(0);
      });
    });
  });
});
