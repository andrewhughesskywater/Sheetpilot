/**
 * @fileoverview Test Data Fixtures
 * 
 * Reusable test data for comprehensive testing across all layers.
 * Provides valid, invalid, and edge case data for timesheet operations.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { TimesheetRow } from '../../src/renderer/business-logic/timesheet-validation';
import type { DbTimesheetEntry } from '../../src/shared/contracts/IDataService';

/**
 * Valid timesheet entries covering all projects, tools, and charge codes
 */
export const validTimesheetEntries: TimesheetRow[] = [
  // FL-Carver Techs project with tool requiring charge code
  {
    id: 1,
    date: '01/15/2025',
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Equipment maintenance and calibration'
  },
  // FL-Carver Tools project with tool not requiring charge code
  {
    id: 2,
    date: '01/16/2025',
    timeIn: '08:30',
    timeOut: '16:30',
    project: 'FL-Carver Tools',
    tool: 'Meeting',
    chargeCode: null,
    taskDescription: 'Team coordination meeting'
  },
  // Project that doesn't require tools
  {
    id: 3,
    date: '01/17/2025',
    timeIn: '10:00',
    timeOut: '18:00',
    project: 'PTO/RTO',
    tool: null,
    chargeCode: null,
    taskDescription: 'Personal time off'
  },
  // OSC-BBB project with tool requiring charge code
  {
    id: 4,
    date: '01/18/2025',
    timeIn: '09:15',
    timeOut: '17:15',
    project: 'OSC-BBB',
    tool: '#1 CSAM101',
    chargeCode: 'EPR2',
    taskDescription: 'Component testing and validation'
  },
  // SWFL-EQUIP project with tool requiring charge code
  {
    id: 5,
    date: '01/19/2025',
    timeIn: '08:45',
    timeOut: '16:45',
    project: 'SWFL-EQUIP',
    tool: 'AFM101',
    chargeCode: 'Repair',
    taskDescription: 'Equipment repair and maintenance'
  },
  // Training project (no tools required)
  {
    id: 6,
    date: '01/20/2025',
    timeIn: '09:30',
    timeOut: '17:30',
    project: 'Training',
    tool: null,
    chargeCode: null,
    taskDescription: 'Safety training and certification'
  }
];

/**
 * Invalid timesheet entries for validation testing
 */
export const invalidTimesheetEntries: TimesheetRow[] = [
  // Missing required fields
  {
    id: 1,
    date: '',
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  {
    id: 2,
    date: '01/15/2025',
    timeIn: '',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  {
    id: 3,
    date: '01/15/2025',
    timeIn: '09:00',
    timeOut: '',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  {
    id: 4,
    date: '01/15/2025',
    timeIn: '09:00',
    timeOut: '17:00',
    project: '',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  {
    id: 5,
    date: '01/15/2025',
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: ''
  },
  // Invalid date formats
  {
    id: 6,
    date: '2025-01-15', // Wrong format (should be mm/dd/yyyy)
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  {
    id: 7,
    date: '1/15/25', // Wrong format (should be mm/dd/yyyy)
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  {
    id: 8,
    date: '13/15/2025', // Invalid month
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  {
    id: 9,
    date: '02/30/2025', // Invalid day for February
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  // Invalid time formats
  {
    id: 10,
    date: '01/15/2025',
    timeIn: '25:00', // Invalid hour
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  {
    id: 11,
    date: '01/15/2025',
    timeIn: '09:01', // Not 15-minute increment
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  {
    id: 12,
    date: '01/15/2025',
    timeIn: '25:00', // Invalid hour
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  {
    id: 13,
    date: '01/15/2025',
    timeIn: '09:60', // Invalid minute
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  // Time out before time in
  {
    id: 14,
    date: '01/15/2025',
    timeIn: '17:00',
    timeOut: '09:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  // Invalid project
  {
    id: 15,
    date: '01/15/2025',
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'Invalid Project',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  // Invalid tool for project
  {
    id: 16,
    date: '01/15/2025',
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: 'Invalid Tool',
    chargeCode: 'EPR1',
    taskDescription: 'Test task'
  },
  // Invalid charge code
  {
    id: 17,
    date: '01/15/2025',
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'Invalid Code',
    taskDescription: 'Test task'
  },
  // Tool requiring charge code but missing charge code
  {
    id: 18,
    date: '01/15/2025',
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: '',
    taskDescription: 'Test task'
  }
];

/**
 * Edge case entries for boundary testing
 */
export const edgeCaseEntries: TimesheetRow[] = [
  // Leap year date
  {
    id: 1,
    date: '02/29/2024',
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Leap year test'
  },
  // Non-leap year February 29th (invalid)
  {
    id: 2,
    date: '02/29/2023',
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Non-leap year test'
  },
  // Midnight times
  {
    id: 3,
    date: '01/15/2025',
    timeIn: '00:00',
    timeOut: '00:15',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Midnight test'
  },
  // Late night times
  {
    id: 4,
    date: '01/15/2025',
    timeIn: '23:30',
    timeOut: '23:45',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Late night test'
  },
  // Very short duration (15 minutes)
  {
    id: 5,
    date: '01/15/2025',
    timeIn: '09:00',
    timeOut: '09:15',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Short duration test'
  },
  // Long duration (12 hours)
  {
    id: 6,
    date: '01/15/2025',
    timeIn: '06:00',
    timeOut: '18:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Long duration test'
  },
  // Quarter boundary dates
  {
    id: 7,
    date: '03/31/2025', // End of Q1
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Q1 boundary test'
  },
  {
    id: 8,
    date: '04/01/2025', // Start of Q2
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    chargeCode: 'EPR1',
    taskDescription: 'Q2 boundary test'
  }
];

/**
 * Database entries (as stored in database)
 */
export const validDbEntries: DbTimesheetEntry[] = [
  {
    id: 1,
    date: '2025-01-15',
    time_in: 540, // 09:00
    time_out: 1020, // 17:00
    hours: 8.0,
    project: 'FL-Carver Techs',
    tool: '#1 Rinse and 2D marker',
    detail_charge_code: 'EPR1',
    task_description: 'Equipment maintenance and calibration',
    status: null, // Pending
    submitted_at: null
  },
  {
    id: 2,
    date: '2025-01-16',
    time_in: 510, // 08:30
    time_out: 990, // 16:30
    hours: 8.0,
    project: 'FL-Carver Tools',
    tool: 'Meeting',
    detail_charge_code: null,
    task_description: 'Team coordination meeting',
    status: 'Complete',
    submitted_at: '2025-01-16T16:30:00Z'
  },
  {
    id: 3,
    date: '2025-01-17',
    time_in: 600, // 10:00
    time_out: 1080, // 18:00
    hours: 8.0,
    project: 'PTO/RTO',
    tool: null,
    detail_charge_code: null,
    task_description: 'Personal time off',
    status: 'Complete',
    submitted_at: '2025-01-17T18:00:00Z'
  }
];

/**
 * Test data for cascading dropdown scenarios
 */
export const cascadingTestCases = [
  // Project that doesn't need tools
  {
    project: 'PTO/RTO',
    expectedToolOptions: [],
    expectedChargeCodeOptions: [],
    shouldClearTool: true,
    shouldClearChargeCode: true
  },
  // Project that needs tools
  {
    project: 'FL-Carver Techs',
    expectedToolOptions: ['DECA Meeting', 'Logistics', '#1 Rinse and 2D marker'],
    expectedChargeCodeOptions: ['Admin', 'EPR1', 'EPR2', 'EPR3', 'EPR4', 'Repair', 'Meeting', 'Other', 'PM', 'Training', 'Upgrade'],
    shouldClearTool: false,
    shouldClearChargeCode: false
  },
  // Tool that doesn't need charge codes
  {
    tool: 'Meeting',
    expectedChargeCodeOptions: [],
    shouldClearChargeCode: true
  },
  // Tool that needs charge codes
  {
    tool: '#1 Rinse and 2D marker',
    expectedChargeCodeOptions: ['Admin', 'EPR1', 'EPR2', 'EPR3', 'EPR4', 'Repair', 'Meeting', 'Other', 'PM', 'Training', 'Upgrade'],
    shouldClearChargeCode: false
  }
];

/**
 * Time format test cases
 */
export const timeFormatTestCases = [
  // Valid HH:MM formats
  { input: '09:00', expected: '09:00', isValid: true },
  { input: '17:30', expected: '17:30', isValid: true },
  { input: '00:00', expected: '00:00', isValid: true },
  { input: '23:45', expected: '23:45', isValid: true },
  
  // Valid numeric formats
  { input: '900', expected: '09:00', isValid: true },
  { input: '1730', expected: '17:30', isValid: true },
  { input: '800', expected: '08:00', isValid: true },
  { input: '1430', expected: '14:30', isValid: true },
  
  // Invalid formats
  { input: '9:00', expected: '9:00', isValid: false }, // Missing leading zero
  { input: '09:01', expected: '09:01', isValid: false }, // Not 15-minute increment
  { input: '25:00', expected: '25:00', isValid: false }, // Invalid hour
  { input: '09:60', expected: '09:60', isValid: false }, // Invalid minute
  { input: 'abc', expected: 'abc', isValid: false }, // Non-numeric
  { input: '', expected: '', isValid: false } // Empty
];

/**
 * Date format test cases
 */
export const dateFormatTestCases = [
  // Valid mm/dd/yyyy formats
  { input: '01/15/2025', expected: '2025-01-15', isValid: true },
  { input: '12/31/2024', expected: '2024-12-31', isValid: true },
  { input: '02/29/2024', expected: '2024-02-29', isValid: true }, // Leap year
  
  // Invalid formats
  { input: '2025-01-15', expected: '2025-01-15', isValid: false }, // Wrong format
  { input: '1/15/25', expected: '1/15/25', isValid: false }, // Wrong format
  { input: '13/15/2025', expected: '13/15/2025', isValid: false }, // Invalid month
  { input: '02/30/2025', expected: '02/30/2025', isValid: false }, // Invalid day
  { input: '02/29/2023', expected: '02/29/2023', isValid: false }, // Non-leap year
  { input: '', expected: '', isValid: false } // Empty
];

/**
 * Quarter validation test cases
 */
export const quarterTestCases = [
  // Q1 2025
  { date: '2025-01-01', quarter: 1, year: 2025, isValid: true },
  { date: '2025-03-31', quarter: 1, year: 2025, isValid: true },
  
  // Q2 2025
  { date: '2025-04-01', quarter: 2, year: 2025, isValid: true },
  { date: '2025-06-30', quarter: 2, year: 2025, isValid: true },
  
  // Q3 2025
  { date: '2025-07-01', quarter: 3, year: 2025, isValid: true },
  { date: '2025-09-30', quarter: 3, year: 2025, isValid: true },
  
  // Q4 2025
  { date: '2025-10-01', quarter: 4, year: 2025, isValid: true },
  { date: '2025-12-31', quarter: 4, year: 2025, isValid: true },
  
  // Invalid quarters
  { date: '2024-12-31', quarter: 4, year: 2024, isValid: false }, // Past quarter
  { date: '2026-01-01', quarter: 1, year: 2026, isValid: false } // Future quarter
];
