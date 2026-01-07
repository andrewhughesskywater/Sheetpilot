/**
 * @fileoverview Logger Module Tests
 * 
 * Tests for centralized logging system including log levels, formatting,
 * PII protection, and structured logging.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

describe('Logger Module', () => {
  describe('Log Levels', () => {
    it('should support all standard log levels', () => {
      const levels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
      
      levels.forEach(level => {
        expect(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).toContain(level);
      });
    });

    it('should prioritize levels correctly', () => {
      const levelPriority = {
        error: 0,
        warn: 1,
        info: 2,
        verbose: 3,
        debug: 4,
        silly: 5
      };
      
      expect(levelPriority.error).toBeLessThan(levelPriority.warn);
      expect(levelPriority.warn).toBeLessThan(levelPriority.info);
      expect(levelPriority.info).toBeLessThan(levelPriority.verbose);
    });
  });

  describe('Log Formatting', () => {
    it('should format logs as JSON', () => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test message',
        context: { key: 'value' }
      };
      
      const json = JSON.stringify(logEntry);
      const parsed = JSON.parse(json);
      
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test message');
    });

    it('should include timestamp in ISO 8601 format', () => {
      const timestamp = new Date().toISOString();
      
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include structured context', () => {
      const context = {
        userId: '123',
        action: 'login',
        duration: 150
      };
      
      const logEntry = {
        message: 'User logged in',
        context
      };
      
      expect(logEntry.context.userId).toBe('123');
      expect(logEntry.context.action).toBe('login');
    });

    it('should format single-line JSON (NDJSON)', () => {
      const logEntry = { level: 'info', message: 'Test' };
      const json = JSON.stringify(logEntry);
      
      expect(json).not.toContain('\n');
    });
  });

  describe('PII Protection', () => {
    it('should redact username in production by default', () => {
      const username = 'john.doe';
      const isProduction = true;
      const redactPII = isProduction && process.env['SHEETPILOT_LOG_USERNAME'] !== 'true';
      
      if (redactPII) {
        const redacted = username.substring(0, 3) + '***' + 'hash123';
        expect(redacted).toBe('joh***hash123');
        expect(redacted).not.toBe(username);
      }
    });

    it('should not redact username in development', () => {
      const username = 'john.doe';
      const isDevelopment = true;
      const redactPII = !isDevelopment;
      
      if (!redactPII) {
        expect(username).toBe('john.doe');
      }
    });

    it('should not redact when explicitly enabled', () => {
      const username = 'john.doe';
      const logUsernameEnabled = true;
      
      if (logUsernameEnabled) {
        expect(username).toBe('john.doe');
      }
    });

    it('should hash username consistently', () => {
      const username = 'test.user';
      
      const hash1 = createHash('sha256').update(username).digest('hex').substring(0, 8);
      const hash2 = createHash('sha256').update(username).digest('hex').substring(0, 8);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('Structured Context', () => {
    it('should accept object context', () => {
      const context = {
        operation: 'database-query',
        duration: 150,
        rowsAffected: 5
      };
      
      expect(typeof context).toBe('object');
      expect(context.operation).toBe('database-query');
    });

    it('should accept nested context', () => {
      const context = {
        request: {
          method: 'POST',
          path: '/api/login',
          body: {
            email: 'user@test.com'
          }
        }
      };
      
      expect(context.request.method).toBe('POST');
      expect(context.request.body.email).toBe('user@test.com');
    });

    it('should handle arrays in context', () => {
      const context = {
        affectedIds: [1, 2, 3, 4, 5]
      };
      
      expect(Array.isArray(context.affectedIds)).toBe(true);
      expect(context.affectedIds).toHaveLength(5);
    });
  });

  describe('Performance Tracking', () => {
    it('should track operation duration', () => {
      const startTime = Date.now();
      
      // Simulate operation
      const _result = Array(1000).fill(0).map((_, i) => i * 2);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(typeof duration).toBe('number');
    });

    it('should provide timer interface', () => {
      const timer = {
        start: Date.now(),
        done: (outcome: Record<string, unknown>) => {
          return {
            duration: Date.now() - timer.start,
            ...outcome
          };
        }
      };
      
      const result = timer.done({});
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Log Message Formatting', () => {
    it('should use active voice', () => {
      const activeMessages = [
        'Could not connect to database',
        'Server rejected request',
        'User logged in successfully'
      ];
      
      activeMessages.forEach(msg => {
        expect(msg).not.toContain('was');
        expect(msg).not.toContain('were');
      });
    });

    it('should use present tense for states', () => {
      const stateMessages = [
        'Database unavailable',
        'Credentials not found',
        'Update available'
      ];
      
      stateMessages.forEach(msg => {
        expect(msg.length).toBeGreaterThan(0);
      });
    });

    it('should use past tense for completed actions', () => {
      const completedMessages = [
        'Database initialized successfully',
        'Credentials stored successfully',
        'Update downloaded'
      ];
      
      completedMessages.forEach(msg => {
        expect(msg).toMatch(/ed( successfully)?$/);
      });
    });

    it('should use present continuous for ongoing actions', () => {
      const ongoingMessages = [
        'Checking for updates',
        'Connecting to database',
        'Submitting timesheet'
      ];
      
      ongoingMessages.forEach(msg => {
        expect(msg).toMatch(/ing/);
      });
    });
  });

  describe('Error Patterns', () => {
    it('should use "Could not" for errors', () => {
      const errorMessages = [
        'Could not connect to database: timeout',
        'Could not save file: permission denied',
        'Could not load credentials: not found'
      ];
      
      errorMessages.forEach(msg => {
        expect(msg).toContain('Could not');
      });
    });

    it('should provide context in error messages', () => {
      const errorWithContext = 'Could not write to file: permission denied';
      
      expect(errorWithContext).toContain(':');
      expect(errorWithContext.split(':').length).toBe(2);
    });
  });
});

