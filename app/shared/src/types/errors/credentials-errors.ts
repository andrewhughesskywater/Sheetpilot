import { AppError, ErrorCategory } from './base';

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
    super(`Credentials not found for service: ${service}`, 'CRED_NOT_FOUND', { ...context, service });
  }
}

/**
 * Failed to store credentials
 * SOC2: Processing integrity issue
 */
export class CredentialsStorageError extends CredentialsError {
  constructor(service: string, context: Record<string, unknown> = {}) {
    super(`Could not store credentials for service: ${service}`, 'CRED_STORAGE_ERROR', { ...context, service });
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
