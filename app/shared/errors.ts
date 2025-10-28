/**
 * @fileoverview Structured Error Classes
 * 
 * Provides domain-specific error types with context for better error handling,
 * logging, and debugging throughout the application.
 * 
 * All errors follow a consistent structure with:
 * - Clear error codes for programmatic handling
 * - Human-readable messages
 * - Optional contextual metadata
 * - ISO9000/SOC2 compliant error tracking
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-10-01
 */

/**
 * Base error class with standardized error handling
 * All domain errors extend this base class
 */
export abstract class AppError extends Error {
    readonly code: string;
    readonly context: Record<string, unknown>;
    readonly timestamp: string;
    readonly category: ErrorCategory;

    constructor(
        message: string,
        code: string,
        category: ErrorCategory,
        context: Record<string, unknown> = {}
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.context = context;
        this.category = category;
        this.timestamp = new Date().toISOString();

        // Maintains proper stack trace for where our error was thrown (only on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Converts error to JSON for logging/transmission
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            category: this.category,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }

    /**
     * Creates a user-friendly error message
     */
    toUserMessage(): string {
        return this.message;
    }
}

/**
 * Error categories for filtering and monitoring
 */
export enum ErrorCategory {
    DATABASE = 'database',
    CREDENTIALS = 'credentials',
    SUBMISSION = 'submission',
    VALIDATION = 'validation',
    NETWORK = 'network',
    IPC = 'ipc',
    CONFIGURATION = 'configuration',
    BUSINESS_LOGIC = 'business_logic',
    SYSTEM = 'system'
}

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
        super(
            'Could not connect to database',
            'DB_CONNECTION_ERROR',
            context
        );
    }
}

/**
 * Database query failed
 */
export class DatabaseQueryError extends DatabaseError {
    constructor(operation: string, context: Record<string, unknown> = {}) {
        super(
            `Could not execute database query: ${operation}`,
            'DB_QUERY_ERROR',
            { ...context, operation }
        );
    }
}

/**
 * Database schema initialization failed
 */
export class DatabaseSchemaError extends DatabaseError {
    constructor(context: Record<string, unknown> = {}) {
        super(
            'Could not initialize database schema',
            'DB_SCHEMA_ERROR',
            context
        );
    }
}

/**
 * Database transaction failed
 */
export class DatabaseTransactionError extends DatabaseError {
    constructor(operation: string, context: Record<string, unknown> = {}) {
        super(
            `Transaction failed: ${operation}`,
            'DB_TRANSACTION_ERROR',
            { ...context, operation }
        );
    }
}

// ============================================================================
// CREDENTIALS ERRORS
// ============================================================================

/**
 * Base class for all credential-related errors
 * SOC2: Security and confidentiality issues
 */
export abstract class CredentialsError extends AppError {
    constructor(message: string, code: string, context: Record<string, unknown> = {}) {
        super(message, code, ErrorCategory.CREDENTIALS, context);
    }
}

/**
 * Credentials not found for a service
 */
export class CredentialsNotFoundError extends CredentialsError {
    constructor(service: string, context: Record<string, unknown> = {}) {
        super(
            `Credentials not found for service: ${service}`,
            'CRED_NOT_FOUND',
            { ...context, service }
        );
    }
}

/**
 * Failed to store credentials
 * SOC2: Processing integrity issue
 */
export class CredentialsStorageError extends CredentialsError {
    constructor(service: string, context: Record<string, unknown> = {}) {
        super(
            `Could not store credentials for service: ${service}`,
            'CRED_STORAGE_ERROR',
            { ...context, service }
        );
    }
}

/**
 * Failed to retrieve credentials
 * SOC2: Confidentiality issue
 */
export class CredentialsRetrievalError extends CredentialsError {
    constructor(service: string, context: Record<string, unknown> = {}) {
        super(
            `Could not retrieve credentials for service: ${service}`,
            'CRED_RETRIEVAL_ERROR',
            { ...context, service }
        );
    }
}

/**
 * Invalid credentials
 */
export class InvalidCredentialsError extends CredentialsError {
    constructor(context: Record<string, unknown> = {}) {
        super(
            'Invalid credentials provided',
            'CRED_INVALID',
            context
        );
    }
}

// ============================================================================
// SUBMISSION ERRORS
// ============================================================================

/**
 * Base class for all submission-related errors
 */
export abstract class SubmissionError extends AppError {
    constructor(message: string, code: string, context: Record<string, unknown> = {}) {
        super(message, code, ErrorCategory.SUBMISSION, context);
    }
}

/**
 * Submission service unavailable
 */
export class SubmissionServiceUnavailableError extends SubmissionError {
    constructor(service: string, context: Record<string, unknown> = {}) {
        super(
            `Submission service unavailable: ${service}`,
            'SUBMISSION_SERVICE_UNAVAILABLE',
            { ...context, service }
        );
    }
}

/**
 * Submission failed
 */
export class SubmissionFailedError extends SubmissionError {
    constructor(reason: string, context: Record<string, unknown> = {}) {
        super(
            `Could not submit timesheet entries: ${reason}`,
            'SUBMISSION_FAILED',
            { ...context, reason }
        );
    }
}

/**
 * No entries to submit
 */
export class NoEntriesToSubmitError extends SubmissionError {
    constructor(context: Record<string, unknown> = {}) {
        super(
            'No pending timesheet entries to submit',
            'SUBMISSION_NO_ENTRIES',
            context
        );
    }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

/**
 * Base class for all validation errors
 */
export abstract class ValidationError extends AppError {
    constructor(message: string, code: string, context: Record<string, unknown> = {}) {
        super(message, code, ErrorCategory.VALIDATION, context);
    }
}

/**
 * Invalid date format
 */
export class InvalidDateError extends ValidationError {
    constructor(date: string, context: Record<string, unknown> = {}) {
        super(
            `Invalid date format: ${date}. Expected MM/DD/YYYY`,
            'VALIDATION_INVALID_DATE',
            { ...context, date }
        );
    }
}

/**
 * Invalid time format
 */
export class InvalidTimeError extends ValidationError {
    constructor(time: string, context: Record<string, unknown> = {}) {
        super(
            `Invalid time format: ${time}. Expected HH:MM or HHMM in 15-minute increments`,
            'VALIDATION_INVALID_TIME',
            { ...context, time }
        );
    }
}

/**
 * Required field missing
 */
export class RequiredFieldError extends ValidationError {
    constructor(field: string, context: Record<string, unknown> = {}) {
        super(
            `Required field missing: ${field}`,
            'VALIDATION_REQUIRED_FIELD',
            { ...context, field }
        );
    }
}

/**
 * Invalid value for field
 */
export class InvalidFieldValueError extends ValidationError {
    constructor(field: string, value: unknown, context: Record<string, unknown> = {}) {
        super(
            `Invalid value for field '${field}': ${String(value)}`,
            'VALIDATION_INVALID_VALUE',
            { ...context, field, value }
        );
    }
}

// ============================================================================
// IPC ERRORS
// ============================================================================

/**
 * Base class for all IPC communication errors
 */
export abstract class IPCError extends AppError {
    constructor(message: string, code: string, context: Record<string, unknown> = {}) {
        super(message, code, ErrorCategory.IPC, context);
    }
}

/**
 * IPC handler not found
 */
export class IPCHandlerNotFoundError extends IPCError {
    constructor(handler: string, context: Record<string, unknown> = {}) {
        super(
            `IPC handler not found: ${handler}`,
            'IPC_HANDLER_NOT_FOUND',
            { ...context, handler }
        );
    }
}

/**
 * IPC communication failed
 */
export class IPCCommunicationError extends IPCError {
    constructor(endpoint: string, context: Record<string, unknown> = {}) {
        super(
            `IPC communication failed: ${endpoint}`,
            'IPC_COMMUNICATION_ERROR',
            { ...context, endpoint }
        );
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely extracts error message from unknown error type
 * Ensures consistent error handling across async/sync boundaries
 */
export function extractErrorMessage(error: unknown): string {
    if (error instanceof AppError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error occurred';
}

/**
 * Safely extracts error code from unknown error type
 */
export function extractErrorCode(error: unknown): string {
    if (error instanceof AppError) {
        return error.code;
    }
    if (error instanceof Error) {
        return 'UNKNOWN_ERROR';
    }
    return 'UNKNOWN_ERROR';
}

/**
 * Safely extracts error context from unknown error type
 */
export function extractErrorContext(error: unknown): Record<string, unknown> {
    if (error instanceof AppError) {
        return error.context;
    }
    return {};
}

/**
 * Determines if an error should be retried
 * Some errors (like network issues) should be retried,
 * others (like validation errors) should not
 */
export function isRetryableError(error: unknown): boolean {
    if (error instanceof AppError) {
        return error.category === ErrorCategory.NETWORK ||
               error.category === ErrorCategory.DATABASE;
    }
    // Unknown errors are not retryable by default
    return false;
}

/**
 * Determines if an error is a security concern
 * SOC2: Track security-relevant errors
 */
export function isSecurityError(error: unknown): boolean {
    if (error instanceof AppError) {
        return error.category === ErrorCategory.CREDENTIALS;
    }
    return false;
}

/**
 * Creates a user-friendly error message from any error
 */
export function createUserFriendlyMessage(error: unknown): string {
    if (error instanceof AppError) {
        return error.toUserMessage();
    }
    return extractErrorMessage(error);
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Type guard to check if error is a DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
    return error instanceof DatabaseError;
}

/**
 * Type guard to check if error is a CredentialsError
 */
export function isCredentialsError(error: unknown): error is CredentialsError {
    return error instanceof CredentialsError;
}

/**
 * Type guard to check if error is a SubmissionError
 */
export function isSubmissionError(error: unknown): error is SubmissionError {
    return error instanceof SubmissionError;
}

/**
 * Type guard to check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError;
}

