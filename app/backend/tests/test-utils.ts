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
import { setDbPath, ensureSchema, getDb } from '../src/models';

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
 * Note: Excel-related test utilities have been removed due to security vulnerabilities
 * in the xlsx package. If Excel file testing is needed in the future, consider:
 * - Using CSV files instead
 * - Mocking file operations
 * - Using a more secure Excel library
 */

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
    const db = getDb();
    
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
export function isValidTimesheetEntry(entry: unknown): boolean {
    if (!entry || typeof entry !== 'object') {
        return false;
    }
    
    const entryObj = entry as Record<string, unknown>;
    
    return (
        typeof entryObj['date'] === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(entryObj['date'] as string) &&
        typeof entryObj['time_in'] === 'number' &&
        typeof entryObj['time_out'] === 'number' &&
        (entryObj['time_out'] as number) > (entryObj['time_in'] as number) &&
        typeof entryObj['project'] === 'string' &&
        (entryObj['project'] as string).length > 0 &&
        typeof entryObj['task_description'] === 'string' &&
        (entryObj['task_description'] as string).length > 0
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
 * Creates a test suite setup function for import tests
 * Note: Excel import testing removed due to xlsx security vulnerabilities
 * 
 * @returns {Object} Setup object with testDbPath and cleanup function
 */
export function setupImportTest() {
    const testDbPath = createTestDatabase();
    
    return {
        testDbPath,
        cleanup: () => cleanupTestFiles([testDbPath])
    };
}
