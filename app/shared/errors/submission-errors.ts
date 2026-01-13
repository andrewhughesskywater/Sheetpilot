import { AppError, ErrorCategory } from './base';

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
 * Submission cancelled by user or system
 */
export class SubmissionCancelledError extends SubmissionError {
  constructor(message: string = 'Submission cancelled', context: Record<string, unknown> = {}) {
    super(message, 'SUBMISSION_CANCELLED', context);
  }
}

/**
 * Submission timed out
 */
export class SubmissionTimeoutError extends SubmissionError {
  constructor(message: string = 'Submission timed out', context: Record<string, unknown> = {}) {
    super(message, 'SUBMISSION_TIMEOUT', context);
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
