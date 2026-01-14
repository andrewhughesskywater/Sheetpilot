import { AppError, ErrorCategory } from './base';

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
    return 'Unknown error encountered';
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
