/**
 * @fileoverview IPC Input Validation Utility Tests
 * 
 * Tests for the validate-ipc-input utility functions to ensure proper
 * input sanitization and error handling.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { validateInput, validateMultiple } from '@/validation/validate-ipc-input';

// Mock logger
vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

describe('IPC Input Validation Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateInput Function', () => {
    const stringSchema = z.string().min(1);
    const objectSchema = z.object({
      name: z.string(),
      age: z.number()
    });

    it('should validate and return valid input', () => {
      const result = validateInput(stringSchema, 'test', 'test-handler');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('test');
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid input', () => {
      const result = validateInput(stringSchema, '', 'test-handler');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid input');
      expect(result.data).toBeUndefined();
    });

    it('should handle complex object validation', () => {
      const validInput = { name: 'John', age: 30 };
      const result = validateInput(objectSchema, validInput, 'test-handler');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it('should reject invalid object properties', () => {
      const invalidInput = { name: 'John', age: 'thirty' };
      const result = validateInput(objectSchema, invalidInput, 'test-handler');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
    });

    it('should handle missing required properties', () => {
      const invalidInput = { name: 'John' }; // Missing age
      const result = validateInput(objectSchema, invalidInput, 'test-handler');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('age');
    });

    it('should format error messages with field paths', () => {
      const nestedSchema = z.object({
        user: z.object({
          email: z.string().email(),
          profile: z.object({
            age: z.number().positive()
          })
        })
      });
      
      const invalidInput = {
        user: {
          email: 'not-an-email',
          profile: {
            age: -5
          }
        }
      };
      
      const result = validateInput(nestedSchema, invalidInput, 'test-handler');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Should include field paths in error message
      expect(result.error).toContain('user');
    });

    it('should handle non-ZodError exceptions gracefully', () => {
      const faultySchema = z.string().transform(() => {
        throw new Error('Custom error');
      });
      
      const result = validateInput(faultySchema, 'test', 'test-handler');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
    });

    it('should handle null and undefined inputs', () => {
      const result1 = validateInput(stringSchema, null, 'test-handler');
      expect(result1.success).toBe(false);
      
      const result2 = validateInput(stringSchema, undefined, 'test-handler');
      expect(result2.success).toBe(false);
    });

    it('should handle array inputs', () => {
      const arraySchema = z.array(z.number());
      const result = validateInput(arraySchema, [1, 2, 3], 'test-handler');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('should reject invalid array elements', () => {
      const arraySchema = z.array(z.number());
      const result = validateInput(arraySchema, [1, 'two', 3], 'test-handler');
      
      expect(result.success).toBe(false);
    });

    it('should handle enum validation', () => {
      const enumSchema = z.enum(['read', 'write', 'execute']);
      
      expect(validateInput(enumSchema, 'read', 'test').success).toBe(true);
      expect(validateInput(enumSchema, 'invalid', 'test').success).toBe(false);
    });

    it('should handle optional fields correctly', () => {
      const optionalSchema = z.object({
        required: z.string(),
        optional: z.string().optional()
      });
      
      const result1 = validateInput(optionalSchema, { required: 'test' }, 'test-handler');
      expect(result1.success).toBe(true);
      
      const result2 = validateInput(optionalSchema, { required: 'test', optional: 'value' }, 'test-handler');
      expect(result2.success).toBe(true);
    });

    it('should handle nullable fields correctly', () => {
      const nullableSchema = z.object({
        required: z.string(),
        nullable: z.string().nullable()
      });
      
      const result = validateInput(nullableSchema, { required: 'test', nullable: null }, 'test-handler');
      expect(result.success).toBe(true);
    });
  });

  describe('validateMultiple Function', () => {
    const emailSchema = z.string().email();
    const passwordSchema = z.string().min(8);
    const ageSchema = z.number().positive();

    it('should validate multiple inputs successfully', () => {
      const validations: Array<[z.ZodSchema, unknown, string]> = [
        [emailSchema, 'user@example.com', 'email'],
        [passwordSchema, 'password123', 'password'],
        [ageSchema, 25, 'age']
      ];
      
      const result = validateMultiple(validations, 'test-handler');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        email: 'user@example.com',
        password: 'password123',
        age: 25
      });
    });

    it('should fail on first invalid input', () => {
      const validations: Array<[z.ZodSchema, unknown, string]> = [
        [emailSchema, 'user@example.com', 'email'],
        [passwordSchema, 'short', 'password'], // Invalid - too short
        [ageSchema, 25, 'age']
      ];
      
      const result = validateMultiple(validations, 'test-handler');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('password');
      expect(result.data).toBeUndefined();
    });

    it('should handle empty validations array', () => {
      const result = validateMultiple([], 'test-handler');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should handle single validation', () => {
      const validations: Array<[z.ZodSchema, unknown, string]> = [
        [emailSchema, 'user@example.com', 'email']
      ];
      
      const result = validateMultiple(validations, 'test-handler');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ email: 'user@example.com' });
    });

    it('should stop validation on first error', () => {
      const validations: Array<[z.ZodSchema, unknown, string]> = [
        [emailSchema, 'invalid-email', 'email'], // First error
        [passwordSchema, 'short', 'password'],   // Should not be validated
        [ageSchema, -5, 'age']                   // Should not be validated
      ];
      
      const result = validateMultiple(validations, 'test-handler');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
      expect(result.error).not.toContain('password');
      expect(result.error).not.toContain('age');
    });

    it('should use field names in error messages', () => {
      const validations: Array<[z.ZodSchema, unknown, string]> = [
        [emailSchema, 'invalid-email', 'userEmail']
      ];
      
      const result = validateMultiple(validations, 'test-handler');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('userEmail');
    });
  });

  describe('Security - Input Sanitization', () => {
    const stringSchema = z.string().max(100);

    it('should handle SQL injection attempts', () => {
      const sqlInjection = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' OR 1=1--"
      ];
      
      sqlInjection.forEach(attack => {
        const result = validateInput(stringSchema, attack, 'test');
        // Schema accepts it as valid string (parameterized queries handle security)
        expect(result.success).toBe(true);
        expect(result.data).toBe(attack);
      });
    });

    it('should handle XSS attempts', () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>'
      ];
      
      xssAttempts.forEach(attack => {
        const result = validateInput(stringSchema, attack, 'test');
        // Schema accepts it as valid string (HTML escaping happens at render time)
        expect(result.success).toBe(true);
        expect(result.data).toBe(attack);
      });
    });

    it('should handle command injection attempts', () => {
      const commandInjection = [
        'test; rm -rf /',
        'test && del /f /q *.*',
        'test | cat /etc/passwd',
        'test`whoami`',
        'test$(whoami)'
      ];
      
      commandInjection.forEach(attack => {
        const result = validateInput(stringSchema, attack, 'test');
        // Schema accepts it as valid string (command execution prevented at system level)
        expect(result.success).toBe(true);
        expect(result.data).toBe(attack);
      });
    });

    it('should enforce length limits to prevent DoS', () => {
      const veryLong = 'a'.repeat(10000);
      const result = validateInput(stringSchema, veryLong, 'test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('String must contain at most 100 character');
    });

    it('should handle unicode and special characters safely', () => {
      const specialChars = [
        'Test with émojis 🚀',
        'Test with üñïçödé',
        'Test with 中文字符',
        'Test with العربية',
        'Test with Кириллица'
      ];
      
      const unicodeSchema = z.string().max(500);
      
      specialChars.forEach(text => {
        const result = validateInput(unicodeSchema, text, 'test');
        expect(result.success).toBe(true);
        expect(result.data).toBe(text);
      });
    });

    it('should handle null bytes', () => {
      const nullByte = 'test\0string';
      const result = validateInput(stringSchema, nullByte, 'test');
      
      // Schema accepts it (null byte handling happens at lower levels)
      expect(result.success).toBe(true);
    });

    it('should handle control characters', () => {
      const controlChars = [
        'test\x00string',  // Null
        'test\x08string',  // Backspace
        'test\x1Bstring',  // Escape
        'test\nstring',    // Newline
        'test\rstring',    // Carriage return
        'test\tstring'     // Tab
      ];
      
      controlChars.forEach(text => {
        const result = validateInput(stringSchema, text, 'test');
        expect(result.success).toBe(true);
        expect(result.data).toBe(text);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle boolean values', () => {
      const boolSchema = z.boolean();
      
      expect(validateInput(boolSchema, true, 'test').success).toBe(true);
      expect(validateInput(boolSchema, false, 'test').success).toBe(true);
      expect(validateInput(boolSchema, 'true', 'test').success).toBe(false);
      expect(validateInput(boolSchema, 1, 'test').success).toBe(false);
    });

    it('should handle numeric edge cases', () => {
      const numSchema = z.number();
      
      expect(validateInput(numSchema, 0, 'test').success).toBe(true);
      expect(validateInput(numSchema, -1, 'test').success).toBe(true);
      expect(validateInput(numSchema, 1.5, 'test').success).toBe(true);
      // Zod rejects Infinity and NaN by default
      expect(validateInput(numSchema, Infinity, 'test').success).toBe(false);
      expect(validateInput(numSchema, -Infinity, 'test').success).toBe(false);
      expect(validateInput(numSchema, NaN, 'test').success).toBe(false);
    });

    it('should handle array edge cases', () => {
      const arraySchema = z.array(z.number());
      
      expect(validateInput(arraySchema, [], 'test').success).toBe(true);
      expect(validateInput(arraySchema, [1], 'test').success).toBe(true);
      expect(validateInput(arraySchema, [1, 2, 3], 'test').success).toBe(true);
      expect(validateInput(arraySchema, 'not-an-array', 'test').success).toBe(false);
    });

    it('should handle deeply nested objects', () => {
      const deepSchema = z.object({
        level1: z.object({
          level2: z.object({
            level3: z.object({
              value: z.string()
            })
          })
        })
      });
      
      const validInput = {
        level1: {
          level2: {
            level3: {
              value: 'test'
            }
          }
        }
      };
      
      const result = validateInput(deepSchema, validInput, 'test');
      expect(result.success).toBe(true);
    });

    it('should handle date objects', () => {
      const dateSchema = z.date();
      const now = new Date();
      
      const result = validateInput(dateSchema, now, 'test');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(now);
    });

    it('should handle union types', () => {
      const unionSchema = z.union([z.string(), z.number()]);
      
      expect(validateInput(unionSchema, 'test', 'test').success).toBe(true);
      expect(validateInput(unionSchema, 123, 'test').success).toBe(true);
      expect(validateInput(unionSchema, true, 'test').success).toBe(false);
    });

    it('should handle optional fields', () => {
      const optionalSchema = z.object({
        required: z.string(),
        optional: z.string().optional()
      });
      
      expect(validateInput(optionalSchema, { required: 'test' }, 'test').success).toBe(true);
      expect(validateInput(optionalSchema, { required: 'test', optional: 'value' }, 'test').success).toBe(true);
    });

    it('should handle literal values', () => {
      const literalSchema = z.literal('exact-value');
      
      expect(validateInput(literalSchema, 'exact-value', 'test').success).toBe(true);
      expect(validateInput(literalSchema, 'other-value', 'test').success).toBe(false);
    });

    it('should handle discriminated unions', () => {
      const discriminatedSchema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('email'), email: z.string().email() }),
        z.object({ type: z.literal('phone'), phone: z.string() })
      ]);
      
      expect(validateInput(discriminatedSchema, { type: 'email', email: 'test@test.com' }, 'test').success).toBe(true);
      expect(validateInput(discriminatedSchema, { type: 'phone', phone: '555-1234' }, 'test').success).toBe(true);
      expect(validateInput(discriminatedSchema, { type: 'invalid' }, 'test').success).toBe(false);
    });
  });

  describe('Error Formatting', () => {
    it('should include multiple error messages when multiple fields invalid', () => {
      const schema = z.object({
        field1: z.string().min(5),
        field2: z.number().positive(),
        field3: z.string().email()
      });
      
      const invalidInput = {
        field1: 'abc',      // Too short
        field2: -5,         // Not positive
        field3: 'invalid'   // Not email
      };
      
      const result = validateInput(schema, invalidInput, 'test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('field1');
      expect(result.error).toContain('field2');
      expect(result.error).toContain('field3');
    });

    it('should separate multiple errors with semicolons', () => {
      const schema = z.object({
        field1: z.string().min(5),
        field2: z.string().min(5)
      });
      
      const result = validateInput(schema, { field1: 'a', field2: 'b' }, 'test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain(';');
    });

    it('should include root level errors without field path', () => {
      const schema = z.string().min(5);
      const result = validateInput(schema, 'abc', 'test');
      
      expect(result.success).toBe(false);
      expect(result.error).not.toMatch(/^:/); // Should not start with colon
    });
  });

  describe('XSS Prevention', () => {
    it('should accept XSS payloads as text (rendering layer handles escaping)', () => {
      const textSchema = z.string().max(1000);
      const xssPayloads = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<body onload=alert(1)>',
        '<input onfocus=alert(1) autofocus>',
        '<marquee onstart=alert(1)>',
        '<details open ontoggle=alert(1)>',
        '<select onfocus=alert(1) autofocus>'
      ];
      
      xssPayloads.forEach(payload => {
        const result = validateInput(textSchema, payload, 'test');
        expect(result.success).toBe(true);
        // Validation accepts it as text; XSS prevention is at rendering layer
      });
    });
  });

  describe('Injection Prevention', () => {
    it('should accept SQL injection attempts as text (prepared statements handle security)', () => {
      const textSchema = z.string().max(1000);
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT password FROM users--",
        "1'; DELETE FROM users WHERE '1'='1'; --"
      ];
      
      sqlPayloads.forEach(payload => {
        const result = validateInput(textSchema, payload, 'test');
        expect(result.success).toBe(true);
        // Validation accepts it as text; SQL injection prevented by parameterization
      });
    });

    it('should accept command injection attempts as text (execution layer handles security)', () => {
      const textSchema = z.string().max(1000);
      const cmdPayloads = [
        '; rm -rf /',
        '&& del /f /q *.*',
        '| cat /etc/passwd',
        '`whoami`',
        '$(whoami)',
        '; shutdown -h now'
      ];
      
      cmdPayloads.forEach(payload => {
        const result = validateInput(textSchema, payload, 'test');
        expect(result.success).toBe(true);
        // Validation accepts it as text; command injection prevented at execution layer
      });
    });

    it('should accept path traversal attempts as text (filesystem layer handles security)', () => {
      const textSchema = z.string().max(1000);
      const pathPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '....//....//....//etc/passwd',
        '..%2F..%2F..%2Fetc%2Fpasswd'
      ];
      
      pathPayloads.forEach(payload => {
        const result = validateInput(textSchema, payload, 'test');
        expect(result.success).toBe(true);
        // Validation accepts it as text; path traversal prevented at filesystem layer
      });
    });
  });

  describe('Type Coercion', () => {
    it('should not coerce strings to numbers by default', () => {
      const numSchema = z.number();
      const result = validateInput(numSchema, '123', 'test');
      
      expect(result.success).toBe(false);
    });

    it('should not coerce numbers to strings by default', () => {
      const strSchema = z.string();
      const result = validateInput(strSchema, 123, 'test');
      
      expect(result.success).toBe(false);
    });

    it('should not coerce strings to booleans', () => {
      const boolSchema = z.boolean();
      
      expect(validateInput(boolSchema, 'true', 'test').success).toBe(false);
      expect(validateInput(boolSchema, 'false', 'test').success).toBe(false);
      expect(validateInput(boolSchema, '1', 'test').success).toBe(false);
      expect(validateInput(boolSchema, '0', 'test').success).toBe(false);
    });
  });
});

