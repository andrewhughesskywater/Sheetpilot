/**
 * @fileoverview Test Utilities
 * 
 * Common utilities and helpers for testing the Sheetpilot application.
 * Provides functions for creating test databases, Excel files, and cleanup operations.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as XLSX from 'xlsx';
import { setDbPath, ensureSchema } from '../backend/database';

/**
 * Creates a temporary test database with a unique name
 * 
 * @returns {string} Path to the temporary database file
 */
export function createTestDatabase(): string {
    const testDbPath = path.join(os.tmpdir(), `sheetpilot-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sqlite`);
    setDbPath(testDbPath);
    ensureSchema();
    return testDbPath;
}

/**
 * Creates a temporary Excel file with the given data
 * 
 * @param {any[][]} data - Array of rows for the Excel file
 * @param {string} [sheetName='Timesheet'] - Name of the sheet to create
 * @returns {string} Path to the temporary Excel file
 */
export function createTestExcelFile(data: any[][], sheetName = 'Timesheet'): string {
    const testExcelPath = path.join(os.tmpdir(), `test-timesheet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.xlsx`);
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, testExcelPath);
    
    return testExcelPath;
}

/**
 * Creates a sample timesheet Excel file with valid data
 * 
 * @param {number} [rowCount=5] - Number of data rows to generate
 * @returns {string} Path to the temporary Excel file
 */
export function createSampleTimesheetFile(rowCount = 5): string {
    const headers = [
        'Date', 'Time In', 'Time Out', 'Project', 'Tool', 'Detail Charge Code', 'Task Description'
    ];
    
    const data = [headers];
    
    for (let i = 0; i < rowCount; i++) {
        const date = new Date(2025, 0, 15 + i); // Start from Jan 15, 2025
        const timeIn = 900 + (i * 60); // Start at 9:00 AM, add 1 hour per row
        const timeOut = timeIn + 60; // 1 hour duration
        
        data.push([
            date,
            timeIn,
            timeOut,
            `Test Project ${i + 1}`,
            i % 2 === 0 ? 'VS Code' : 'IntelliJ',
            `DEV-${(i + 1).toString().padStart(3, '0')}`,
            `Test task ${i + 1}`
        ]);
    }
    
    return createTestExcelFile(data);
}

/**
 * Creates a test Excel file with invalid data for error testing
 * 
 * @returns {string} Path to the temporary Excel file
 */
export function createInvalidTimesheetFile(): string {
    const data = [
        ['Date', 'Time In', 'Time Out', 'Project', 'Tool', 'Detail Charge Code', 'Task Description'],
        ['invalid-date', 900, 1000, '', 'VS Code', 'DEV-001', ''], // Invalid date, empty required fields
        ['01/15/2025', 901, 1000, 'Test Project', 'VS Code', 'DEV-001', 'Invalid time'], // Invalid time (not 15-min increment)
        ['01/16/2025', 1000, 900, 'Test Project', 'VS Code', 'DEV-001', 'Time order error'] // time_out < time_in
    ];
    
    return createTestExcelFile(data);
}

/**
 * Creates a test Excel file with missing columns
 * 
 * @returns {string} Path to the temporary Excel file
 */
export function createIncompleteTimesheetFile(): string {
    const data = [
        ['Date', 'Time In', 'Time Out', 'Project'], // Missing required columns
        ['01/15/2025', 900, 1000, 'Test Project']
    ];
    
    return createTestExcelFile(data);
}

/**
 * Cleans up temporary files
 * 
 * @param {string[]} filePaths - Array of file paths to delete
 */
export function cleanupTestFiles(filePaths: string[]): void {
    filePaths.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (error) {
                console.warn(`Could not delete test file ${filePath}:`, error);
            }
        }
    });
}

/**
 * Gets database statistics for testing
 * 
 * @returns {Object} Database statistics
 */
export function getDatabaseStats(): { count: number; projects: string[]; dateRange: { min: string; max: string } } {
    const { openDb } = require('../backend/database');
    const db = openDb();
    
    try {
        const count = db.prepare('SELECT COUNT(*) as count FROM timesheet').get() as { count: number };
        const projects = db.prepare('SELECT DISTINCT project FROM timesheet ORDER BY project').all() as { project: string }[];
        const dateRange = db.prepare('SELECT MIN(date) as min, MAX(date) as max FROM timesheet').get() as { min: string; max: string };
        
        return {
            count: count.count,
            projects: projects.map(p => p.project),
            dateRange
        };
    } finally {
        db.close();
    }
}

/**
 * Validates timesheet entry data structure
 * 
 * @param {any} entry - Timesheet entry to validate
 * @returns {boolean} True if entry is valid
 */
export function isValidTimesheetEntry(entry: any): boolean {
    return (
        entry &&
        typeof entry.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
        typeof entry.time_in === 'number' &&
        typeof entry.time_out === 'number' &&
        entry.time_out > entry.time_in &&
        typeof entry.project === 'string' &&
        entry.project.length > 0 &&
        typeof entry.task_description === 'string' &&
        entry.task_description.length > 0
    );
}

/**
 * Creates a test suite setup function for database tests
 * 
 * @returns {Object} Setup object with testDbPath and cleanup function
 */
export function setupDatabaseTest() {
    const testDbPath = createTestDatabase();
    
    return {
        testDbPath,
        cleanup: () => cleanupTestFiles([testDbPath])
    };
}

/**
 * Creates a test suite setup function for Excel import tests
 * 
 * @returns {Object} Setup object with testDbPath, testExcelPath and cleanup function
 */
export function setupImportTest() {
    const testDbPath = createTestDatabase();
    const testExcelPath = createSampleTimesheetFile();
    
    return {
        testDbPath,
        testExcelPath,
        cleanup: () => cleanupTestFiles([testDbPath, testExcelPath])
    };
}
