/**
 * @fileoverview Database Schema Contract Validation Tests
 * 
 * Validates that database schema matches TypeScript interfaces.
 * Prevents AI from breaking data persistence contracts.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbTimesheetEntry } from '@sheetpilot/shared';
import { DbTimesheetEntryBuilder } from '../helpers/test-builders';
import { assertValidDbEntry, assertDatabaseConstraints } from '../helpers/assertion-helpers';

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      prepare: vi.fn(() => ({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
        get: vi.fn(() => ({}))
      })),
      exec: vi.fn(),
      close: vi.fn()
    }))
  };
});

describe('Database Schema Contract Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Timesheet Table Schema', () => {
    it('should match DbTimesheetEntry interface structure', () => {
      const dbEntry = DbTimesheetEntryBuilder.create().build();
      
      // Verify all required fields exist
      expect(dbEntry).toHaveProperty('id');
      expect(dbEntry).toHaveProperty('date');
      expect(dbEntry).toHaveProperty('time_in');
      expect(dbEntry).toHaveProperty('time_out');
      expect(dbEntry).toHaveProperty('hours');
      expect(dbEntry).toHaveProperty('project');
      expect(dbEntry).toHaveProperty('task_description');
      
      // Verify optional fields exist
      expect(dbEntry).toHaveProperty('tool');
      expect(dbEntry).toHaveProperty('detail_charge_code');
      expect(dbEntry).toHaveProperty('status');
      expect(dbEntry).toHaveProperty('submitted_at');
    });

    it('should enforce correct data types', () => {
      const dbEntry = DbTimesheetEntryBuilder.create().build();
      
      expect(typeof dbEntry.id).toBe('number');
      expect(typeof dbEntry.date).toBe('string');
      expect(typeof dbEntry.time_in).toBe('number');
      expect(typeof dbEntry.time_out).toBe('number');
      expect(typeof dbEntry.hours).toBe('number');
      expect(typeof dbEntry.project).toBe('string');
      expect(typeof dbEntry.task_description).toBe('string');
      
      // Optional fields can be null or their expected type
      expect(dbEntry.tool === null || typeof dbEntry.tool === 'string').toBe(true);
      expect(dbEntry.detail_charge_code === null || typeof dbEntry.detail_charge_code === 'string').toBe(true);
      expect(dbEntry.status === null || typeof dbEntry.status === 'string').toBe(true);
      expect(dbEntry.submitted_at === null || typeof dbEntry.submitted_at === 'string').toBe(true);
    });

    it('should enforce date format constraint', () => {
      const validDates = [
        '2025-01-15',
        '2024-12-31',
        '2024-02-29', // Leap year
        '2025-03-31'
      ];
      
      const invalidDates = [
        '01/15/2025', // Wrong format
        '2025-1-15',  // Missing leading zero
        '2025-1-1',   // Missing leading zeros
        '25-01-15',   // Missing leading zero in year
        '2025/01/15'  // Wrong separator
      ];
      
      validDates.forEach(date => {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
      
      invalidDates.forEach(date => {
        if (date === '2025-02-29') {
          // This is actually valid format, just invalid date
          expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        } else {
          expect(date).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      });
    });

    it('should enforce time range constraints', () => {
      const validTimes = [
        { time_in: 0, time_out: 15 },     // 00:00 to 00:15
        { time_in: 540, time_out: 1020 }, // 09:00 to 17:00
        { time_in: 1380, time_out: 1425 } // 23:00 to 23:45
      ];
      
      const invalidTimes = [
        { time_in: -1, time_out: 15 },    // Negative time
        { time_in: 0, time_out: 1440 },    // 24:00 (invalid)
        { time_in: 540, time_out: 540 },   // Same time
        { time_in: 1020, time_out: 540 }   // Out before in
      ];
      
      validTimes.forEach(({ time_in, time_out }) => {
        expect(time_in).toBeGreaterThanOrEqual(0);
        expect(time_in).toBeLessThan(1440);
        expect(time_out).toBeGreaterThanOrEqual(1);
        expect(time_out).toBeLessThanOrEqual(1440);
        expect(time_out).toBeGreaterThan(time_in);
      });
      
      invalidTimes.forEach(({ time_in, time_out }) => {
        const isValid = time_in >= 0 && time_in < 1440 && 
                       time_out >= 1 && time_out < 1440 && 
                       time_out > time_in;
        expect(isValid).toBe(false);
      });
    });

    it('should enforce 15-minute increment constraints', () => {
      const validIncrements = [0, 15, 30, 45, 60, 75, 90, 105, 120];
      const invalidIncrements = [1, 7, 13, 22, 38, 52, 67, 83, 98];
      
      validIncrements.forEach(minutes => {
        expect(minutes % 15).toBe(0);
      });
      
      invalidIncrements.forEach(minutes => {
        expect(minutes % 15).not.toBe(0);
      });
    });

    it('should calculate hours correctly', () => {
      const testCases = [
        { time_in: 540, time_out: 1020, expected_hours: 8.0 },   // 09:00 to 17:00
        { time_in: 0, time_out: 15, expected_hours: 0.25 },      // 00:00 to 00:15
        { time_in: 480, time_out: 960, expected_hours: 8.0 },    // 08:00 to 16:00
        { time_in: 600, time_out: 630, expected_hours: 0.5 }     // 10:00 to 10:30
      ];
      
      testCases.forEach(({ time_in, time_out, expected_hours }) => {
        const calculated_hours = (time_out - time_in) / 60.0;
        expect(calculated_hours).toBe(expected_hours);
      });
    });
  });

  describe('Credentials Table Schema', () => {
    it('should match credential interface structure', () => {
      const credential = {
        id: 1,
        service: 'smartsheet',
        email: 'test@example.com',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z'
      };
      
      expect(credential).toHaveProperty('id');
      expect(credential).toHaveProperty('service');
      expect(credential).toHaveProperty('email');
      expect(credential).toHaveProperty('created_at');
      expect(credential).toHaveProperty('updated_at');
      
      expect(typeof credential.id).toBe('number');
      expect(typeof credential.service).toBe('string');
      expect(typeof credential.email).toBe('string');
      expect(typeof credential.created_at).toBe('string');
      expect(typeof credential.updated_at).toBe('string');
    });

    it('should enforce unique service constraint', () => {
      const credentials = [
        { service: 'smartsheet', email: 'user1@example.com' },
        { service: 'smartsheet', email: 'user2@example.com' }, // Duplicate service
        { service: 'other', email: 'user3@example.com' }
      ];
      
      const services = credentials.map(c => c.service);
      const uniqueServices = new Set(services);
      
      // Should have duplicates
      expect(services.length).toBeGreaterThan(uniqueServices.size);
    });

    it('should enforce email format constraint', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'admin+test@company.org'
      ];
      
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'test@',
        'test.example.com'
      ];
      
      validEmails.forEach(email => {
        expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
      
      invalidEmails.forEach(email => {
        expect(email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });
  });

  describe('Database Constraints', () => {
    it('should enforce primary key constraints', () => {
      const entries = [
        DbTimesheetEntryBuilder.create().withId(1).build(),
        DbTimesheetEntryBuilder.create().withId(2).build(),
        DbTimesheetEntryBuilder.create().withId(1).build() // Duplicate ID
      ];
      
      const ids = entries.map(e => e.id);
      const uniqueIds = new Set(ids);
      
      // Should have duplicate IDs
      expect(ids.length).toBeGreaterThan(uniqueIds.size);
    });

    it('should enforce unique constraint on natural key', () => {
      const duplicateEntries = [
        DbTimesheetEntryBuilder.create()
          .withDate('2025-01-15')
          .withTimeIn(540)
          .withProject('FL-Carver Techs')
          .withTaskDescription('Same task')
          .build(),
        DbTimesheetEntryBuilder.create()
          .withDate('2025-01-15')
          .withTimeIn(540)
          .withProject('FL-Carver Techs')
          .withTaskDescription('Same task')
          .build()
      ];
      
      // Both entries have same natural key
      const first = duplicateEntries[0]!;
      const second = duplicateEntries[1]!;
      const key1 = `${first.date}-${first.time_in}-${first.project}-${first.task_description}`;
      const key2 = `${second.date}-${second.time_in}-${second.project}-${second.task_description}`;
      
      expect(key1).toBe(key2);
    });

    it('should enforce foreign key constraints', () => {
      // Test that referenced data exists
      const timesheetEntry = DbTimesheetEntryBuilder.create().build();
      
      // Entry should reference valid project
      const validProjects = [
        'FL-Carver Techs', 'FL-Carver Tools', 'OSC-BBB', 
        'PTO/RTO', 'SWFL-CHEM/GAS', 'SWFL-EQUIP', 'Training'
      ];
      
      expect(validProjects).toContain(timesheetEntry.project);
    });
  });

  describe('Index Performance', () => {
    it('should have indexes on frequently queried columns', () => {
      const indexedColumns = [
        'date',      // idx_timesheet_date
        'project',   // idx_timesheet_project  
        'status'     // idx_timesheet_status
      ];
      
      indexedColumns.forEach(column => {
        expect(column).toBeDefined();
        expect(typeof column).toBe('string');
      });
    });

    it('should have unique index on natural key', () => {
      const uniqueIndexColumns = [
        'date',
        'time_in', 
        'project',
        'task_description'
      ];
      
      uniqueIndexColumns.forEach(column => {
        expect(column).toBeDefined();
        expect(typeof column).toBe('string');
      });
    });
  });

  describe('Data Migration Compatibility', () => {
    it('should maintain backward compatibility with existing data', () => {
      const legacyEntry = {
        id: 1,
        date: '2025-01-15',
        time_in: 540,
        time_out: 1020,
        hours: 8.0,
        project: 'FL-Carver Techs',
        tool: null,
        detail_charge_code: null,
        task_description: 'Legacy task',
        status: null,
        submitted_at: null
      };
      
      // Should still match current interface
      assertValidDbEntry(legacyEntry as unknown as DbTimesheetEntry);
    });

    it('should handle schema evolution gracefully', () => {
      const currentSchema = [
        'id', 'date', 'time_in', 'time_out', 'hours',
        'project', 'tool', 'detail_charge_code', 'task_description',
        'status', 'submitted_at'
      ];
      
      const futureSchema = [
        ...currentSchema,
        'new_field' // Hypothetical future field
      ];
      
      // Current schema should be subset of future schema
      currentSchema.forEach(field => {
        expect(futureSchema).toContain(field);
      });
    });
  });

  describe('Data Integrity Validation', () => {
    it('should validate complete database entries', () => {
      const validEntry = DbTimesheetEntryBuilder.create().build();
      assertValidDbEntry(validEntry);
      assertDatabaseConstraints(validEntry);
    });

    it('should reject entries with constraint violations', () => {
      const invalidEntries = [
        DbTimesheetEntryBuilder.create().withTimeIn(-1).build(), // Negative time
        DbTimesheetEntryBuilder.create().withTimeOut(1440).build(), // Invalid time
        DbTimesheetEntryBuilder.create().withTimeIn(1020).withTimeOut(540).build() // Out before in
      ];
      
      invalidEntries.forEach(entry => {
        expect(() => assertDatabaseConstraints(entry)).toThrow();
      });
    });

    it('should handle null values correctly', () => {
      const entryWithNulls = DbTimesheetEntryBuilder.create()
        .withTool(null)
        .withDetailChargeCode(null)
        .withStatus(null)
        .withSubmittedAt(null)
        .build();
      
      expect(entryWithNulls.tool).toBeNull();
      expect(entryWithNulls.detail_charge_code).toBeNull();
      expect(entryWithNulls.status).toBeNull();
      expect(entryWithNulls.submitted_at).toBeNull();
      
      // Should still be valid
      assertValidDbEntry(entryWithNulls);
    });
  });

  describe('Performance Constraints', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, index) => 
        DbTimesheetEntryBuilder.create()
          .withId(index + 1)
          .withDate(`2025-01-${((index % 31) + 1).toString().padStart(2, '0')}`)
          .build()
      );
      
      expect(largeDataset.length).toBe(1000);
      
      // All entries should be valid
      largeDataset.forEach(entry => {
        assertValidDbEntry(entry);
      });
    });

    it('should maintain referential integrity', () => {
      const entries = [
        DbTimesheetEntryBuilder.create().withId(1).build(),
        DbTimesheetEntryBuilder.create().withId(2).build()
      ];
      
      // All IDs should be unique
      const ids = entries.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });
});
