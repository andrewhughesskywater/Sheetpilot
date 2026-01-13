import { AppError } from './base';
import { DatabaseError } from './database-errors';
import { CredentialsError } from './credentials-errors';
import { SubmissionError } from './submission-errors';
import { ValidationError } from './validation-errors';

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
