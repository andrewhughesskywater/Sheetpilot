/**
 * @fileoverview Custom Assertion Helpers
 * 
 * Custom assertion functions for more readable and specific test validations.
 * Provides domain-specific assertions for timesheet data and business rules.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { expect } from 'vitest';
import type { TimesheetRow } from '@/logic/timesheet-validation';
import type { DbTimesheetEntry } from '@sheetpilot/shared/contracts/IDataService';
import { isValidDate, isValidTime, isTimeOutAfterTimeIn } from '@/logic/timesheet-validation';

/**
 * Assert that a timesheet row has valid required fields
 */
export function assertValidTimesheetRow(row: TimesheetRow): void {
  expect(row.date).toBeTruthy();
  expect(row.timeIn).toBeTruthy();
  expect(row.timeOut).toBeTruthy();
  expect(row.project).toBeTruthy();
  expect(row.taskDescription).toBeTruthy();
}

/**
 * Assert that a timesheet row has invalid required fields
 */
export function assertInvalidTimesheetRow(row: TimesheetRow, expectedMissingField?: string): void {
  const invalidFields: string[] = [];
  
  // Check for missing or empty required fields
  if (!row.date || (typeof row.date === 'string' && row.date.trim() === '')) {
    invalidFields.push('date');
  } else if (typeof row.date === 'string' && !isValidDate(row.date)) {
    // Check date validity
    invalidFields.push('date');
  }
  
  if (!row.timeIn || (typeof row.timeIn === 'string' && row.timeIn.trim() === '')) {
    invalidFields.push('timeIn');
  } else if (typeof row.timeIn === 'string' && !isValidTime(row.timeIn)) {
    // Check time validity
    invalidFields.push('timeIn');
  }
  
  if (!row.timeOut || (typeof row.timeOut === 'string' && row.timeOut.trim() === '')) {
    invalidFields.push('timeOut');
  } else if (typeof row.timeOut === 'string' && !isValidTime(row.timeOut)) {
    // Check time validity
    invalidFields.push('timeOut');
  }
  
  if (!row.project || (typeof row.project === 'string' && row.project.trim() === '')) {
    invalidFields.push('project');
  }
  
  if (!row.taskDescription || (typeof row.taskDescription === 'string' && row.taskDescription.trim() === '')) {
    invalidFields.push('taskDescription');
  }
  
  // Check time relationship (time out must be after time in)
  if (row.timeIn && row.timeOut && !isTimeOutAfterTimeIn(row.timeIn, row.timeOut)) {
    invalidFields.push('timeRelationship');
  }
  
  expect(invalidFields.length).toBeGreaterThan(0);
  
  if (expectedMissingField) {
    expect(invalidFields).toContain(expectedMissingField);
  }
}

/**
 * Assert that a date string is in the correct format (mm/dd/yyyy)
 */
export function assertValidDateFormat(dateStr: string): void {
  expect(dateStr).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  
  const parts = dateStr.split('/').map(Number);
  const month = parts[0];
  const day = parts[1];
  const year = parts[2];
  
  if (month && day && year) {
    const date = new Date(year, month - 1, day);
    expect(date.getFullYear()).toBe(year);
    expect(date.getMonth()).toBe(month - 1);
    expect(date.getDate()).toBe(day);
  }
}

/**
 * Assert that a time string is in the correct format and 15-minute increment
 */
export function assertValidTimeFormat(timeStr: string): void {
  expect(timeStr).toMatch(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
  
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1];
  
  if (hours !== undefined && minutes !== undefined) {
    const totalMinutes = hours * 60 + minutes;
    expect(totalMinutes % 15).toBe(0);
  }
}

/**
 * Assert that time out is after time in
 */
export function assertTimeOutAfterTimeIn(timeIn: string, timeOut: string): void {
  const inParts = timeIn.split(':').map(Number);
  const outParts = timeOut.split(':').map(Number);
  const inHours = inParts[0];
  const inMinutes = inParts[1];
  const outHours = outParts[0];
  const outMinutes = outParts[1];
  
  if (inHours !== undefined && inMinutes !== undefined && outHours !== undefined && outMinutes !== undefined) {
    const inTotalMinutes = inHours * 60 + inMinutes;
    const outTotalMinutes = outHours * 60 + outMinutes;
    
    expect(outTotalMinutes).toBeGreaterThan(inTotalMinutes);
  }
}

/**
 * Assert that a project requires tool selection
 */
export function assertProjectNeedsTools(project: string): void {
  const projectsWithoutTools = ['ERT', 'PTO/RTO', 'SWFL-CHEM/GAS', 'Training'];
  expect(projectsWithoutTools).not.toContain(project);
}

/**
 * Assert that a project doesn't require tool selection
 */
export function assertProjectDoesNotNeedTools(project: string): void {
  const projectsWithoutTools = ['ERT', 'PTO/RTO', 'SWFL-CHEM/GAS', 'Training'];
  expect(projectsWithoutTools).toContain(project);
}

/**
 * Assert that a tool requires charge code selection
 */
export function assertToolNeedsChargeCode(tool: string): void {
  const toolsWithoutCharges = [
    'Internal Meeting', 'DECA Meeting', 'Logistics', 'Meeting', 
    'Non Tool Related', 'Admin', 'Training', 'N/A'
  ];
  expect(toolsWithoutCharges).not.toContain(tool);
}

/**
 * Assert that a tool doesn't require charge code selection
 */
export function assertToolDoesNotNeedChargeCode(tool: string): void {
  const toolsWithoutCharges = [
    'Internal Meeting', 'DECA Meeting', 'Logistics', 'Meeting', 
    'Non Tool Related', 'Admin', 'Training', 'N/A'
  ];
  expect(toolsWithoutCharges).toContain(tool);
}

/**
 * Assert that cascading rules are applied correctly
 */
export function assertCascadingRulesApplied(row: TimesheetRow): void {
  const projectsWithoutTools = ['ERT', 'PTO/RTO', 'SWFL-CHEM/GAS', 'Training'];
  const toolsWithoutCharges = [
    'Internal Meeting', 'DECA Meeting', 'Logistics', 'Meeting', 
    'Non Tool Related', 'Admin', 'Training', 'N/A'
  ];
  
  if (projectsWithoutTools.includes(row.project || '')) {
    expect(row['tool']).toBeNull();
    expect(row['chargeCode']).toBeNull();
  }
  
  if (toolsWithoutCharges.includes(row['tool'] || '')) {
    expect(row['chargeCode']).toBeNull();
  }
}

/**
 * Assert that a database entry has correct structure
 */
export function assertValidDbEntry(entry: DbTimesheetEntry): void {
  expect(entry.id).toBeGreaterThan(0);
  expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(entry.time_in).toBeGreaterThanOrEqual(0);
  expect(entry.time_in).toBeLessThan(1440); // 24 hours in minutes
  expect(entry.time_out).toBeGreaterThan(entry.time_in);
  expect(entry.time_out).toBeLessThanOrEqual(1440);
  expect(entry.hours).toBeGreaterThan(0);
  expect(entry.project).toBeTruthy();
  expect(entry.task_description).toBeTruthy();
  expect(entry.time_in % 15).toBe(0); // 15-minute increment
  expect(entry.time_out % 15).toBe(0); // 15-minute increment
}

/**
 * Assert that time conversion is consistent
 */
export function assertTimeConversionConsistency(timeStr: string, minutes: number): void {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0];
  const minutesFromStr = parts[1];
  
  if (hours !== undefined && minutesFromStr !== undefined) {
    const expectedMinutes = hours * 60 + minutesFromStr;
    expect(minutes).toBe(expectedMinutes);
  }
}

/**
 * Assert that date conversion is consistent
 */
export function assertDateConversionConsistency(dateStr: string, isoDate: string): void {
  const parts = dateStr.split('/').map(Number);
  const month = parts[0];
  const day = parts[1];
  const year = parts[2];
  
  if (month && day && year) {
    const expectedIsoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    expect(isoDate).toBe(expectedIsoDate);
  }
}

/**
 * Assert that IPC payload has correct structure
 */
export function assertValidIPCPayload(payload: Record<string, unknown>): void {
  expect(payload).toHaveProperty('date');
  expect(payload).toHaveProperty('timeIn');
  expect(payload).toHaveProperty('timeOut');
  expect(payload).toHaveProperty('project');
  expect(payload).toHaveProperty('taskDescription');
  
  // Optional fields can be null
  if (payload['tool'] !== undefined) {
    expect(typeof payload['tool'] === 'string' || payload['tool'] === null).toBe(true);
  }
  if (payload['chargeCode'] !== undefined) {
    expect(typeof payload['chargeCode'] === 'string' || payload['chargeCode'] === null).toBe(true);
  }
}

/**
 * Assert that validation error message is user-friendly
 */
export function assertUserFriendlyErrorMessage(errorMessage: string): void {
  // Check that error message is simple and clear
  expect(errorMessage.length).toBeLessThan(100);
  expect(errorMessage).not.toContain('undefined');
  expect(errorMessage).not.toContain('null');
  expect(errorMessage).not.toContain('Error:');
  expect(errorMessage).not.toContain('Exception');
  
  // Check for common user-friendly patterns
  const friendlyPatterns = [
    /Please enter/,
    /Please pick/,
    /must be/,
    /should be/,
    /is required/
  ];
  
  const hasFriendlyPattern = friendlyPatterns.some(pattern => pattern.test(errorMessage));
  expect(hasFriendlyPattern).toBe(true);
}

/**
 * Assert that quarter validation works correctly
 */
export function assertQuarterValidation(dateStr: string, expectedValid: boolean): void {
  const parts = dateStr.split('/').map(Number);
  const month = parts[0];
  const day = parts[1];
  const year = parts[2];
  
  if (month && day && year) {
    const date = new Date(year, month - 1, day);
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
    
    const entryYear = date.getFullYear();
    const entryQuarter = Math.floor(date.getMonth() / 3) + 1;
    
    const isValid = entryYear === currentYear && entryQuarter === currentQuarter;
    
    expect(isValid).toBe(expectedValid);
  }
}

/**
 * Assert that database constraints are enforced
 */
export function assertDatabaseConstraints(entry: DbTimesheetEntry): void {
  // Time range constraints
  if (entry.time_in < 0 || entry.time_in >= 1440) {
    throw new Error(`Invalid time_in: ${entry.time_in}`);
  }
  if (entry.time_out < 1 || entry.time_out >= 1440) {
    throw new Error(`Invalid time_out: ${entry.time_out}`);
  }
  
  // Time relationship constraint
  if (entry.time_out <= entry.time_in) {
    throw new Error(`time_out (${entry.time_out}) must be greater than time_in (${entry.time_in})`);
  }
  
  // 15-minute increment constraints
  if (entry.time_in % 15 !== 0) {
    throw new Error(`time_in must be in 15-minute increments: ${entry.time_in}`);
  }
  if (entry.time_out % 15 !== 0) {
    throw new Error(`time_out must be in 15-minute increments: ${entry.time_out}`);
  }
  
  // Hours calculation constraint
  const expectedHours = (entry.time_out - entry.time_in) / 60.0;
  if (Math.abs(entry.hours - expectedHours) > 0.001) {
    throw new Error(`Hours calculation mismatch: expected ${expectedHours}, got ${entry.hours}`);
  }
}

/**
 * Assert that plugin interface is implemented correctly
 */
export function assertPluginInterface(plugin: Record<string, unknown>, interfaceName: string): void {
  const requiredMethods = {
    'IDataService': ['saveDraft', 'loadDraft', 'deleteDraft', 'getArchiveData', 'getAllTimesheetEntries'],
    'ISubmissionService': ['submit', 'validateEntry', 'isAvailable'],
    'ICredentialService': ['store', 'get', 'list', 'delete']
  };
  
  const methods = requiredMethods[interfaceName as keyof typeof requiredMethods];
  expect(methods).toBeDefined();
  
  methods.forEach(method => {
    expect(plugin[method]).toBeDefined();
    expect(typeof plugin[method]).toBe('function');
  });
}

/**
 * Assert that test data is properly isolated
 */
export function assertTestDataIsolation(entries1: unknown[], entries2: unknown[]): void {
  // Check that arrays are different instances
  expect(entries1).not.toBe(entries2);
  
  // Check that modifying one doesn't affect the other
  if (entries1.length > 0) {
    const originalLength = entries2.length;
    entries1.push({ test: 'isolation' });
    expect(entries2.length).toBe(originalLength);
  }
}
