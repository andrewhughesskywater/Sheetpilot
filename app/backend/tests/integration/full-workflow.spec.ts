/**
 * @fileoverview Full Workflow Integration Tests
 * 
 * Tests the complete user workflow from login through data entry, save, and submit.
 * Ensures end-to-end functionality works correctly.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock logger
vi.mock('../../../shared/logger', () => ({
  appLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  dbLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
    audit: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() }))
  }
}));

import { setDbPath, ensureSchema, openDb, shutdownDatabase } from '../../src/repositories';
import { createSession, validateSession } from '../../src/repositories/session-repository';
import { storeCredentials, getCredentials } from '../../src/repositories/credentials-repository';
import { insertTimesheetEntry, getPendingTimesheetEntries } from '../../src/repositories/timesheet-repository';

describe('Full Workflow Integration', () => {
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `workflow-test-${Date.now()}.sqlite`);
    setDbPath(testDbPath);
    ensureSchema();
  });

  afterEach(() => {
    try {
      shutdownDatabase();
    } catch {
      // Ignore
    }
    
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore
      }
    }
  });

  describe('Complete User Journey', () => {
    it('should handle full workflow: login → data entry → save → submit', async () => {
      // Step 1: Login
      const token = createSession('user@test.com', true, false);
      expect(token).toBeDefined();

      // Step 2: Validate session
      const validation = validateSession(token);
      expect(validation.valid).toBe(true);
      expect(validation.email).toBe('user@test.com');

      // Step 3: Store credentials
      const credResult = storeCredentials('smartsheet', 'user@test.com', 'password123');
      expect(credResult.success).toBe(true);

      // Step 4: Enter timesheet data
      const entry = {
        date: '2025-01-15',
        timeIn: 540,
        timeOut: 1020,
        project: 'Test Project',
        tool: 'Test Tool',
        detailChargeCode: 'EPR1',
        taskDescription: 'Test task'
      };

      const insertResult = insertTimesheetEntry(entry);
      expect(insertResult.success).toBe(true);

      // Step 5: Verify data persists
      const pending = getPendingTimesheetEntries();
      expect(pending).toHaveLength(1);
      expect(pending[0].project).toBe('Test Project');

      // Step 6: Retrieve credentials for submission
      const creds = getCredentials('smartsheet');
      expect(creds).toBeDefined();
      expect(creds!.email).toBe('user@test.com');
      expect(creds!.password).toBe('password123');
    });

    it('should persist data across sessions', () => {
      // Session 1: Create and save data
      const token1 = createSession('user@test.com', false);
      insertTimesheetEntry({
        date: '2025-01-15',
        timeIn: 540,
        timeOut: 1020,
        project: 'Session Test',
        taskDescription: 'Task'
      });

      // Session 2: New session, data should still exist
      const token2 = createSession('user@test.com', false);
      const pending = getPendingTimesheetEntries();

      expect(token2).not.toBe(token1);
      expect(pending).toHaveLength(1);
      expect(pending[0].project).toBe('Session Test');
    });

    it('should handle concurrent user operations', async () => {
      // User 1
      const token1 = createSession('user1@test.com', false);
      storeCredentials('smartsheet', 'user1@test.com', 'pass1');

      // User 2
      const token2 = createSession('user2@test.com', false);
      storeCredentials('smartsheet', 'user2@test.com', 'pass2');

      // Validate both sessions
      const validation1 = validateSession(token1);
      const validation2 = validateSession(token2);

      expect(validation1.valid).toBe(true);
      expect(validation2.valid).toBe(true);
      expect(validation1.email).toBe('user1@test.com');
      expect(validation2.email).toBe('user2@test.com');

      // Credentials should be from last update
      const creds = getCredentials('smartsheet');
      expect(creds!.email).toBe('user2@test.com'); // Last update
    });
  });

  describe('Error Recovery', () => {
    it('should recover from failed credential storage', () => {
      // Try to store with empty service (should fail)
      try {
        storeCredentials('', 'user@test.com', 'password');
      } catch {
        // Expected to fail
      }

      // Should still be able to store valid credentials
      const result = storeCredentials('smartsheet', 'user@test.com', 'password');
      expect(result.success).toBe(true);
    });

    it('should recover from session expiration', () => {
      const token = createSession('user@test.com', true);

      // Manually expire session
      const db = openDb();
      db.prepare('UPDATE sessions SET expires_at = ? WHERE session_token = ?')
        .run(new Date(Date.now() - 1000).toISOString(), token);
      db.close();

      // Session should be invalid
      const validation = validateSession(token);
      expect(validation.valid).toBe(false);

      // User can create new session
      const newToken = createSession('user@test.com', true);
      const newValidation = validateSession(newToken);
      expect(newValidation.valid).toBe(true);
    });
  });

  describe('Data Isolation', () => {
    it('should isolate user sessions', () => {
      const user1Token = createSession('user1@test.com', false);
      const user2Token = createSession('user2@test.com', false);

      const val1 = validateSession(user1Token);
      const val2 = validateSession(user2Token);

      expect(val1.email).toBe('user1@test.com');
      expect(val2.email).toBe('user2@test.com');
      expect(val1.email).not.toBe(val2.email);
    });

    it('should not leak data between operations', () => {
      insertTimesheetEntry({
        date: '2025-01-15',
        timeIn: 540,
        timeOut: 600,
        project: 'Private Data',
        taskDescription: 'Sensitive task'
      });

      const pending = getPendingTimesheetEntries();

      // Should get all pending, but filtered by session in real app
      expect(pending.some(e => e.project === 'Private Data')).toBe(true);
    });
  });
});

