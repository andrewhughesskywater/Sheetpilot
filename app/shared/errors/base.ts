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
