/**
 * Error exports
 * Re-exports all error types and utilities
 */

// Base classes and enums
export { AppError, ErrorCategory } from './base';

// Database errors
export {
    DatabaseError,
    DatabaseConnectionError,
    DatabaseQueryError,
    DatabaseSchemaError,
    DatabaseTransactionError
} from './database-errors';

// Credentials errors
export {
    CredentialsError,
    CredentialsNotFoundError,
    CredentialsStorageError,
    CredentialsRetrievalError,
    InvalidCredentialsError
} from './credentials-errors';

// Submission errors
export {
    SubmissionError,
    SubmissionCancelledError,
    SubmissionTimeoutError,
    SubmissionServiceUnavailableError,
    SubmissionFailedError,
    NoEntriesToSubmitError
} from './submission-errors';

// Validation errors
export {
    ValidationError,
    InvalidDateError,
    InvalidTimeError,
    RequiredFieldError,
    InvalidFieldValueError
} from './validation-errors';

// IPC errors
export {
    IPCError,
    IPCHandlerNotFoundError,
    IPCCommunicationError
} from './ipc-errors';

// General errors
export {
    NetworkError,
    ConfigurationError,
    BusinessLogicError,
    SystemError
} from './general-errors';

// Utility functions
export {
    extractErrorMessage,
    extractErrorCode,
    extractErrorContext,
    isRetryableError,
    isSecurityError,
    createUserFriendlyMessage
} from './error-utils';

// Type guards
export {
    isAppError,
    isDatabaseError,
    isCredentialsError,
    isSubmissionError,
    isValidationError
} from './error-type-guards';
