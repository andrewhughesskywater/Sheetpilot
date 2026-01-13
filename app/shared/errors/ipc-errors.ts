import { AppError, ErrorCategory } from './base';

// ============================================================================
// IPC ERRORS
// ============================================================================

/**
 * Base class for all IPC communication errors
 */
export class IPCError extends AppError {
  constructor(message: string, context?: Record<string, unknown>);
  constructor(message: string, code: string, context?: Record<string, unknown>);
  constructor(message: string, codeOrContext?: string | Record<string, unknown>, maybeContext?: Record<string, unknown>) {
    const code = typeof codeOrContext === 'string' ? codeOrContext : 'IPC_ERROR';
    const context = typeof codeOrContext === 'string' ? (maybeContext ?? {}) : (codeOrContext ?? {});
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
