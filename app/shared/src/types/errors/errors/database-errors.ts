import { AppError, ErrorCategory } from './base';

// ============================================================================
// DATABASE ERRORS
// ============================================================================

/**
 * Base class for all database-related errors
 */
export abstract class DatabaseError extends AppError {
  constructor(message: string, code: string, context: Record<string, unknown> = {}) {
    super(message, code, ErrorCategory.DATABASE, context);
  }
}

/**
 * Database connection failed
 * SOC2: Availability issue
 */
export class DatabaseConnectionError extends DatabaseError {
  constructor(context: Record<string, unknown> = {}) {
    super('Could not connect to database', 'DB_CONNECTION_ERROR', context);
  }
}

/**
 * Database query failed
 */
export class DatabaseQueryError extends DatabaseError {
  constructor(operation: string, context: Record<string, unknown> = {}) {
    super(`Could not execute database query: ${operation}`, 'DB_QUERY_ERROR', { ...context, operation });
  }
}

/**
 * Database schema initialization failed
 */
export class DatabaseSchemaError extends DatabaseError {
  constructor(context: Record<string, unknown> = {}) {
    super('Could not initialize database schema', 'DB_SCHEMA_ERROR', context);
  }
}

/**
 * Database transaction failed
 */
export class DatabaseTransactionError extends DatabaseError {
  constructor(operation: string, context: Record<string, unknown> = {}) {
    super(`Transaction failed: ${operation}`, 'DB_TRANSACTION_ERROR', { ...context, operation });
  }
}
