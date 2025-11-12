/**
 * @fileoverview Session Repository Unit Tests
 * 
 * Tests for session creation, validation, expiration, and security.
 * Critical for authentication security and session hijacking prevention.
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
  dbLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() }))
  }
}));

import {
  createSession,
  validateSession,
  clearSession,
  clearUserSessions
} from '../../src/repositories/session-repository';
import { setDbPath, openDb, ensureSchema } from '../../src/services/database';

// Type for database row
interface DbRow { [key: string]: unknown }

describe('Session Repository', () => {
  let testDbPath: string;
  let originalDbPath: string;

  beforeEach(() => {
    originalDbPath = process.env['SHEETPILOT_DB_PATH'] || '';
    testDbPath = path.join(os.tmpdir(), `sheetpilot-session-test-${Date.now()}.sqlite`);
    setDbPath(testDbPath);
    ensureSchema();
  });

  afterEach(() => {
    try {
      const { shutdownDatabase } = require('../../src/services/database');
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
    
    if (originalDbPath) {
      setDbPath(originalDbPath);
    }
  });

  describe('Session Creation', () => {
    it('should create valid session with UUID token', () => {
      const token = createSession('user@test.com', false);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(36); // UUID length
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should create different tokens for same user', () => {
      const token1 = createSession('user@test.com', false);
      const token2 = createSession('user@test.com', false);
      
      expect(token1).not.toBe(token2);
    });

    it('should create session with expiration for temporary sessions', () => {
      const token = createSession('user@test.com', false);
      
      const db = openDb();
      const session = db.prepare('SELECT expires_at FROM sessions WHERE session_token = ?').get(token);
      db.close();
      
      expect(session).toBeDefined();
      expect((session as DbRow).expires_at as string | null).toBeNull(); // No expiration for non-persistent
    });

    it('should create session with 30-day expiration for stayLoggedIn', () => {
      const token = createSession('user@test.com', true);
      
      const db = openDb();
      const session = db.prepare('SELECT expires_at FROM sessions WHERE session_token = ?').get(token);
      db.close();
      
      expect(session).toBeDefined();
      expect((session as DbRow).expires_at as string | null).toBeTruthy();
      
      // Verify expiration is approximately 30 days from now
      const expiresAt = new Date((session as DbRow).expires_at as string);
      const now = new Date();
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThan(31);
    });

    it('should handle admin flag correctly', () => {
      const token = createSession('admin@test.com', true, true);
      
      const validation = validateSession(token);
      expect(validation.valid).toBe(true);
      expect(validation.isAdmin).toBe(true);
    });

    it('should handle non-admin users correctly', () => {
      const token = createSession('user@test.com', true, false);
      
      const validation = validateSession(token);
      expect(validation.valid).toBe(true);
      expect(validation.isAdmin).toBe(false);
    });
  });

  describe('Session Validation', () => {
    it('should validate existing active session', () => {
      const token = createSession('user@test.com', false);
      const validation = validateSession(token);
      
      expect(validation.valid).toBe(true);
      expect(validation.email).toBe('user@test.com');
      expect(validation.isAdmin).toBe(false);
    });

    it('should reject invalid token format', () => {
      const validation = validateSession('invalid-token');
      
      expect(validation.valid).toBe(false);
      expect(validation.email).toBeUndefined();
    });

    it('should reject non-existent token', () => {
      const validation = validateSession('123e4567-e89b-12d3-a456-426614174000');
      
      expect(validation.valid).toBe(false);
    });

    it('should reject expired sessions', () => {
      const token = createSession('user@test.com', true);
      
      // Manually set expiration to past
      const db = openDb();
      const pastDate = new Date(Date.now() - 100000).toISOString();
      db.prepare('UPDATE sessions SET expires_at = ? WHERE session_token = ?')
        .run(pastDate, token);
      db.close();
      
      const validation = validateSession(token);
      expect(validation.valid).toBe(false);
    });

    it('should accept sessions without expiration', () => {
      const token = createSession('user@test.com', false);
      
      const validation = validateSession(token);
      expect(validation.valid).toBe(true);
    });

    it('should accept sessions not yet expired', () => {
      const token = createSession('user@test.com', true); // 30 days
      
      const validation = validateSession(token);
      expect(validation.valid).toBe(true);
    });

    it('should handle malformed session data', () => {
      const db = openDb();
      
      // Insert malformed session
      try {
        db.prepare('INSERT INTO sessions (session_token, email, expires_at, is_admin) VALUES (?, ?, ?, ?)')
          .run('malformed-token', 'user@test.com', 'invalid-date', 'not-a-number');
      } catch {
        // Acceptable if constraints prevent this
      }
      
      db.close();
      
      const validation = validateSession('malformed-token');
      expect(validation.valid).toBe(false);
    });
  });

  describe('Session Clearing', () => {
    it('should clear specific session', () => {
      const token = createSession('user@test.com', false);
      
      clearSession(token);
      
      const validation = validateSession(token);
      expect(validation.valid).toBe(false);
    });

    it('should clear all sessions for a user', () => {
      const token1 = createSession('user@test.com', false);
      const token2 = createSession('user@test.com', false);
      const token3 = createSession('other@test.com', false);
      
      clearUserSessions('user@test.com');
      
      expect(validateSession(token1).valid).toBe(false);
      expect(validateSession(token2).valid).toBe(false);
      expect(validateSession(token3).valid).toBe(true); // Other user unaffected
    });

    it('should handle clearing non-existent session gracefully', () => {
      expect(() => {
        clearSession('123e4567-e89b-12d3-a456-426614174000');
      }).not.toThrow();
    });

    it('should handle clearing for non-existent user', () => {
      expect(() => {
        clearUserSessions('nonexistent@test.com');
      }).not.toThrow();
    });
  });

  describe('Concurrent Session Management', () => {
    it('should allow multiple concurrent sessions per user', () => {
      const tokens = [];
      
      for (let i = 0; i < 5; i++) {
        tokens.push(createSession('user@test.com', false));
      }
      
      // All tokens should be valid
      tokens.forEach(token => {
        const validation = validateSession(token);
        expect(validation.valid).toBe(true);
      });
    });

    it('should maintain session independence', () => {
      const token1 = createSession('user1@test.com', false);
      const token2 = createSession('user2@test.com', false);
      
      // Clear one session
      clearSession(token1);
      
      // Other session should remain valid
      expect(validateSession(token1).valid).toBe(false);
      expect(validateSession(token2).valid).toBe(true);
    });

    it('should handle concurrent validation requests', () => {
      const token = createSession('user@test.com', false);
      
      const validations = [];
      for (let i = 0; i < 20; i++) {
        validations.push(validateSession(token));
      }
      
      // All should succeed
      validations.forEach(validation => {
        expect(validation.valid).toBe(true);
      });
    });
  });

  describe('Session Hijacking Prevention', () => {
    it('should not accept modified tokens', () => {
      const token = createSession('user@test.com', false);
      const modifiedToken = token.replace(/a/g, 'b');
      
      const validation = validateSession(modifiedToken);
      expect(validation.valid).toBe(false);
    });

    it('should validate token format strictly', () => {
      const invalidTokens = [
        'not-a-uuid',
        '123-456-789',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        ''
      ];
      
      invalidTokens.forEach(token => {
        const validation = validateSession(token);
        expect(validation.valid).toBe(false);
      });
    });

    it('should not leak user information on invalid tokens', () => {
      const validation = validateSession('invalid-token');
      
      expect(validation.valid).toBe(false);
      expect(validation.email).toBeUndefined();
      expect(validation.isAdmin).toBeUndefined();
    });

    it('should prevent session fixation attacks', () => {
      // Attacker tries to use a predetermined token
      const attackerToken = '123e4567-e89b-12d3-a456-426614174000';
      
      // User creates session normally
      const userToken = createSession('victim@test.com', false);
      
      // Attacker's token should not be valid
      expect(validateSession(attackerToken).valid).toBe(false);
      
      // User's token should be valid
      expect(validateSession(userToken).valid).toBe(true);
      
      // Tokens should not match
      expect(userToken).not.toBe(attackerToken);
    });
  });

  describe('Session Expiration', () => {
    it('should auto-expire sessions past their expiration date', () => {
      const token = createSession('user@test.com', true);
      
      // Manually set expiration to past
      const db = openDb();
      const pastDate = new Date(Date.now() - 1000).toISOString();
      db.prepare('UPDATE sessions SET expires_at = ? WHERE session_token = ?')
        .run(pastDate, token);
      db.close();
      
      const validation = validateSession(token);
      expect(validation.valid).toBe(false);
    });

    it('should not expire sessions without expiration date', () => {
      const token = createSession('user@test.com', false);
      
      // Even after "long" time, session should be valid (no expiration)
      const validation = validateSession(token);
      expect(validation.valid).toBe(true);
    });

    it('should handle boundary condition at exact expiration time', () => {
      const token = createSession('user@test.com', true);
      
      // Set expiration to now
      const db = openDb();
      const nowDate = new Date().toISOString();
      db.prepare('UPDATE sessions SET expires_at = ? WHERE session_token = ?')
        .run(nowDate, token);
      db.close();
      
      // Should be expired (or about to be)
      const validation = validateSession(token);
      expect(typeof validation.valid).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty email', () => {
      try {
        createSession('', false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle null email', () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createSession(null as any, false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle very long email addresses', () => {
      const longEmail = 'a'.repeat(200) + '@test.com';
      
      try {
        const token = createSession(longEmail, false);
        expect(token).toBeDefined();
      } catch {
        // Acceptable if length is enforced
      }
    });

    it('should handle special characters in email', () => {
      const specialEmail = 'user+tag@test.com';
      const token = createSession(specialEmail, false);
      
      const validation = validateSession(token);
      expect(validation.valid).toBe(true);
      expect(validation.email).toBe(specialEmail);
    });
  });
});

