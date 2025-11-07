/**
 * @fileoverview Error Classes Tests
 * 
 * Tests for custom error classes, error serialization, and error handling.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import {
  DatabaseConnectionError,
  DatabaseSchemaError,
  CredentialsNotFoundError,
  InvalidCredentialsError,
  InvalidDateError,
  RequiredFieldError
} from '../errors';

describe('Error Classes', () => {
  describe('DatabaseConnectionError', () => {
    it('should create error with message', () => {
      const error = new DatabaseConnectionError({ reason: 'Connection failed' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Could not connect to database');
      expect(error.name).toBe('DatabaseConnectionError');
    });

    it('should preserve stack trace', () => {
      const error = new DatabaseConnectionError({ reason: 'Test error' });
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DatabaseConnectionError');
    });
  });

  describe('DatabaseSchemaError', () => {
    it('should create error with message', () => {
      const error = new DatabaseSchemaError({ reason: 'Schema invalid' });
      
      expect(error.message).toBe('Could not initialize database schema');
      expect(error.name).toBe('DatabaseSchemaError');
    });
  });

  describe('CredentialsNotFoundError', () => {
    it('should create error with message', () => {
      const error = new CredentialsNotFoundError('smartsheet', { userId: '123' });
      
      expect(error.message).toBe('Credentials not found for service: smartsheet');
      expect(error.name).toBe('CredentialsNotFoundError');
    });

    it('should be catchable', () => {
      try {
        throw new CredentialsNotFoundError('smartsheet');
      } catch (error) {
        expect(error).toBeInstanceOf(CredentialsNotFoundError);
      }
    });
  });

  describe('InvalidCredentialsError', () => {
    it('should create error with message', () => {
      const error = new InvalidCredentialsError({ reason: 'Invalid format' });
      
      expect(error.message).toBe('Invalid credentials provided');
      expect(error.name).toBe('InvalidCredentialsError');
    });
  });

  describe('InvalidDateError', () => {
    it('should create error with message', () => {
      const error = new InvalidDateError('13/32/2023', { field: 'startDate' });
      
      expect(error.message).toBe('Invalid date format: 13/32/2023. Expected MM/DD/YYYY');
      expect(error.name).toBe('InvalidDateError');
    });
  });

  describe('RequiredFieldError', () => {
    it('should create error with message', () => {
      const error = new RequiredFieldError('email', { formId: 'login' });
      
      expect(error.message).toBe('Required field missing: email');
      expect(error.name).toBe('RequiredFieldError');
    });
  });

  describe('Error Hierarchy', () => {
    it('should all extend Error', () => {
      const errors = [
        new DatabaseConnectionError(),
        new DatabaseSchemaError(),
        new CredentialsNotFoundError('smartsheet'),
        new InvalidCredentialsError(),
        new InvalidDateError('invalid'),
        new RequiredFieldError('field')
      ];
      
      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
      });
    });

    it('should be distinguishable by instanceof', () => {
      const dbError = new DatabaseConnectionError();
      const credError = new CredentialsNotFoundError('smartsheet');
      
      expect(dbError).toBeInstanceOf(DatabaseConnectionError);
      expect(dbError).not.toBeInstanceOf(CredentialsNotFoundError);
      expect(credError).toBeInstanceOf(CredentialsNotFoundError);
      expect(credError).not.toBeInstanceOf(DatabaseConnectionError);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize to JSON', () => {
      const error = new RequiredFieldError('testField');
      
      const serialized = error.toJSON();
      
      const json = JSON.stringify(serialized);
      const parsed = JSON.parse(json);
      
      expect(parsed.name).toBe('RequiredFieldError');
      expect(parsed.message).toBe('Required field missing: testField');
      expect(parsed.code).toBeDefined();
    });

    it('should preserve error information', () => {
      const error = new DatabaseSchemaError({ reason: 'Schema mismatch' });
      
      expect(error.message).toBe('Could not initialize database schema');
      expect(error.name).toBe('DatabaseSchemaError');
      expect(error.stack).toBeDefined();
    });
  });

  describe('Error Context Preservation', () => {
    it('should maintain error context through throw/catch', () => {
      try {
        throw new DatabaseConnectionError({ timeout: 5000 });
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseConnectionError);
        expect((error as DatabaseConnectionError).message).toBe('Could not connect to database');
        expect((error as DatabaseConnectionError).context.timeout).toBe(5000);
      }
    });

    it('should preserve stack trace through throw/catch', () => {
      let caughtStack: string | undefined;
      
      try {
        throw new RequiredFieldError('test');
      } catch (error) {
        caughtStack = (error as Error).stack;
      }
      
      expect(caughtStack).toBeDefined();
      expect(caughtStack).toContain('RequiredFieldError');
    });
  });

  describe('Error Messages', () => {
    it('should use active voice in error messages', () => {
      const errors = [
        new DatabaseConnectionError(),
        new InvalidCredentialsError(),
        new CredentialsNotFoundError('smartsheet')
      ];
      
      errors.forEach(error => {
        expect(error.message).not.toContain('was');
        expect(error.message).not.toContain('were');
      });
    });

    it('should be descriptive', () => {
      const error = new InvalidDateError('13/32/2023');
      
      expect(error.message.length).toBeGreaterThan(10);
      expect(error.message).toContain('MM/DD/YYYY');
    });
  });
});

