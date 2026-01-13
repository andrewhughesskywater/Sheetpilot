import { AppError, ErrorCategory } from './base';

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

/**
 * Base class for all validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>);
  constructor(message: string, code: string, context?: Record<string, unknown>);
  constructor(message: string, codeOrContext?: string | Record<string, unknown>, maybeContext?: Record<string, unknown>) {
    const code = typeof codeOrContext === 'string' ? codeOrContext : 'VALIDATION_ERROR';
    const context = typeof codeOrContext === 'string' ? (maybeContext ?? {}) : (codeOrContext ?? {});
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
