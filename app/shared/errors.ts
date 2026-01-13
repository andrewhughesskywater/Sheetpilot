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

// Base classes and enums
export { AppError, ErrorCategory } from './errors/base';

// Database errors
export {
    DatabaseError,
    DatabaseConnectionError,
    DatabaseQueryError,
    DatabaseSchemaError,
    DatabaseTransactionError
} from './errors/database-errors';

// Credentials errors
export {
    CredentialsError,
    CredentialsNotFoundError,
    CredentialsStorageError,
    CredentialsRetrievalError,
    InvalidCredentialsError
} from './errors/credentials-errors';

// Submission errors
export {
    SubmissionError,
    SubmissionCancelledError,
    SubmissionTimeoutError,
    SubmissionServiceUnavailableError,
    SubmissionFailedError,
    NoEntriesToSubmitError
} from './errors/submission-errors';

// Validation errors
export {
    ValidationError,
    InvalidDateError,
    InvalidTimeError,
    RequiredFieldError,
    InvalidFieldValueError
} from './errors/validation-errors';

// IPC errors
export {
    IPCError,
    IPCHandlerNotFoundError,
    IPCCommunicationError
} from './errors/ipc-errors';

// General errors
export {
    NetworkError,
    ConfigurationError,
    BusinessLogicError,
    SystemError
} from './errors/general-errors';

// Utility functions
export {
    extractErrorMessage,
    extractErrorCode,
    extractErrorContext,
    isRetryableError,
    isSecurityError,
    createUserFriendlyMessage
} from './errors/error-utils';

// Type guards
export {
    isAppError,
    isDatabaseError,
    isCredentialsError,
    isSubmissionError,
    isValidationError
} from './errors/error-type-guards';
