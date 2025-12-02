import { describe, it, expect } from 'vitest';
import {
  AppError,
  ErrorCategory,
  DatabaseError,
  DatabaseConnectionError,
  DatabaseSchemaError,
  DatabaseQueryError,
  CredentialsError,
  CredentialsNotFoundError,
  CredentialsStorageError,
  SubmissionError,
  SubmissionCancelledError,
  SubmissionTimeoutError,
  ValidationError,
  NetworkError,
  IPCError,
  ConfigurationError,
  BusinessLogicError,
  SystemError
} from '../errors';

describe('errors', () => {
  describe('AppError', () => {
    class TestError extends AppError {
      constructor(message: string, code: string, context?: Record<string, unknown>) {
        super(message, code, ErrorCategory.SYSTEM, context);
      }
    }

    it('should create error with all properties', () => {
      const error = new TestError('Test message', 'TEST_CODE', { key: 'value' });
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.context).toEqual({ key: 'value' });
      expect(error.name).toBe('TestError');
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
    });

    it('should convert to JSON', () => {
      const error = new TestError('Test message', 'TEST_CODE', { key: 'value' });
      const json = error.toJSON();
      
      expect(json).toHaveProperty('name', 'TestError');
      expect(json).toHaveProperty('code', 'TEST_CODE');
      expect(json).toHaveProperty('message', 'Test message');
      expect(json).toHaveProperty('category', ErrorCategory.SYSTEM);
      expect(json).toHaveProperty('context', { key: 'value' });
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('stack');
    });

    it('should create user-friendly message', () => {
      const error = new TestError('Test message', 'TEST_CODE');
      expect(error.toUserMessage()).toBe('Test message');
    });
  });

  describe('ErrorCategory', () => {
    it('should have all expected categories', () => {
      expect(ErrorCategory.DATABASE).toBe('database');
      expect(ErrorCategory.CREDENTIALS).toBe('credentials');
      expect(ErrorCategory.SUBMISSION).toBe('submission');
      expect(ErrorCategory.VALIDATION).toBe('validation');
      expect(ErrorCategory.NETWORK).toBe('network');
      expect(ErrorCategory.IPC).toBe('ipc');
      expect(ErrorCategory.CONFIGURATION).toBe('configuration');
      expect(ErrorCategory.BUSINESS_LOGIC).toBe('business_logic');
      expect(ErrorCategory.SYSTEM).toBe('system');
    });
  });

  describe('DatabaseError', () => {
    it('should create database error', () => {
      const error = new DatabaseConnectionError('Connection failed', { dbPath: '/test.db' });
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.code).toBe('DATABASE_CONNECTION_ERROR');
      expect(error.context).toEqual({ dbPath: '/test.db' });
    });

    it('should create schema error', () => {
      const error = new DatabaseSchemaError('Schema invalid', { table: 'test' });
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.code).toBe('DATABASE_SCHEMA_ERROR');
    });

    it('should create query error', () => {
      const error = new DatabaseQueryError('Query failed', { sql: 'SELECT * FROM test' });
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.code).toBe('DATABASE_QUERY_ERROR');
    });
  });

  describe('CredentialsError', () => {
    it('should create credentials not found error', () => {
      const error = new CredentialsNotFoundError('Service not found', { service: 'test' });
      
      expect(error).toBeInstanceOf(CredentialsError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.CREDENTIALS);
      expect(error.code).toBe('CREDENTIALS_NOT_FOUND');
    });

    it('should create credentials storage error', () => {
      const error = new CredentialsStorageError('Storage failed', { service: 'test' });
      
      expect(error).toBeInstanceOf(CredentialsError);
      expect(error.category).toBe(ErrorCategory.CREDENTIALS);
      expect(error.code).toBe('CREDENTIALS_STORAGE_ERROR');
    });
  });

  describe('SubmissionError', () => {
    it('should create submission cancelled error', () => {
      const error = new SubmissionCancelledError('Cancelled by user');
      
      expect(error).toBeInstanceOf(SubmissionError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.SUBMISSION);
      expect(error.code).toBe('SUBMISSION_CANCELLED');
    });

    it('should create submission timeout error', () => {
      const error = new SubmissionTimeoutError('Timeout after 30s', { timeout: 30000 });
      
      expect(error).toBeInstanceOf(SubmissionError);
      expect(error.category).toBe(ErrorCategory.SUBMISSION);
      expect(error.code).toBe('SUBMISSION_TIMEOUT');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('NetworkError', () => {
    it('should create network error', () => {
      const error = new NetworkError('Network failed', { url: 'https://example.com' });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('IPCError', () => {
    it('should create IPC error', () => {
      const error = new IPCError('IPC failed', { channel: 'test:channel' });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.IPC);
      expect(error.code).toBe('IPC_ERROR');
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Config invalid', { key: 'test' });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.CONFIGURATION);
      expect(error.code).toBe('CONFIGURATION_ERROR');
    });
  });

  describe('BusinessLogicError', () => {
    it('should create business logic error', () => {
      const error = new BusinessLogicError('Business rule violated', { rule: 'test' });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(error.code).toBe('BUSINESS_LOGIC_ERROR');
    });
  });

  describe('SystemError', () => {
    it('should create system error', () => {
      const error = new SystemError('System failure', { component: 'test' });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.code).toBe('SYSTEM_ERROR');
    });
  });
});
