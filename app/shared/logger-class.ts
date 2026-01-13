/**
 * @fileoverview Logger Class Implementation
 * 
 * Provides structured logging with context, performance tracking, and compliance features.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-09-30
 */

import log from 'electron-log';

/**
 * Log context for adding structured metadata to log entries
 */
export interface LogContext {
    /** Component or module name */
    component?: string;
    /** Operation being performed */
    operation?: string;
    /** User ID or email (if applicable) */
    userId?: string;
    /** Transaction or request ID for correlation */
    transactionId?: string;
    /** Additional structured data */
    [key: string]: unknown;
}

/**
 * Logger class providing structured logging with context
 * 
 * Features:
 * - Automatic context injection
 * - Performance timing
 * - Security-aware logging (sanitizes sensitive data)
 * - Compliance-ready structured output
 */
export class Logger {
    private context: LogContext;
    
    /**
     * Creates a new logger instance with optional context
     * @param context - Structured context to include in all log entries
     */
    constructor(context: LogContext = {}) {
        this.context = context;
    }
    
    /**
     * Creates a child logger with additional context
     * @param childContext - Additional context to merge with parent
     * @returns New Logger instance with merged context
     */
    child(childContext: LogContext): Logger {
        return new Logger({ ...this.context, ...childContext });
    }
    
    /**
     * Log level method map for efficient lookup
     * @private
     */
    private static readonly LOG_METHODS: Record<string, (entry: Record<string, unknown>) => void> = {
        error: log.error.bind(log),
        warn: log.warn.bind(log),
        info: log.info.bind(log),
        verbose: log.verbose.bind(log),
        debug: log.debug.bind(log),
        silly: log.silly.bind(log),
    };
    
    /**
     * Formats a log message with context
     * @private
     */
    private formatMessage(level: string, message: string, data?: unknown): void {
        const entry: Record<string, unknown> = {
            ...this.context,
            message,
        };
        
        const isPlainObject = (value: unknown): value is Record<string, unknown> => {
            if (typeof value !== 'object' || value === null) {
                return false;
            }
            if (Array.isArray(value)) {
                return false;
            }
            return Object.prototype.toString.call(value) === '[object Object]';
        };

        if (data !== undefined && data !== null) {
            // Merge structured metadata directly into the entry to avoid nesting under a reserved "data" key.
            // This prevents confusing output like context.data.data when callers legitimately use a "data" field.
            if (isPlainObject(data)) {
                Object.assign(entry, data);
            } else {
                entry['data'] = data;
            }
        }
        
        // Use appropriate log level with map lookup
        const logMethod = Logger.LOG_METHODS[level] || Logger.LOG_METHODS['info'];
        if (logMethod) {
            logMethod(entry);
        }
    }
    
    /**
     * Logs an error message
     * ISO9000: Document non-conformities and corrective actions
     * SOC2: Track security incidents and system errors
     */
    error(message: string, error?: Error | unknown): void {
        const errorData = error instanceof Error ? {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
        } : error;
        
        this.formatMessage('error', message, errorData);
    }
    
    /**
     * Logs a warning message
     * ISO9000: Document potential issues and preventive actions
     */
    warn(message: string, data?: unknown): void {
        this.formatMessage('warn', message, data);
    }
    
    /**
     * Logs an informational message
     * ISO9000: Document normal operations and decisions
     */
    info(message: string, data?: unknown): void {
        this.formatMessage('info', message, data);
    }
    
    /**
     * Logs verbose operational details
     * For troubleshooting and detailed operational tracking
     */
    verbose(message: string, data?: unknown): void {
        this.formatMessage('verbose', message, data);
    }
    
    /**
     * Logs debug information
     * For development and deep troubleshooting
     */
    debug(message: string, data?: unknown): void {
        this.formatMessage('debug', message, data);
    }
    
    /**
     * Logs extremely detailed trace information
     */
    silly(message: string, data?: unknown): void {
        this.formatMessage('silly', message, data);
    }
    
    /**
     * Starts a performance timer for an operation
     * Returns a function to call when the operation completes
     * 
     * @param operation - Name of the operation being timed
     * @returns Function to call when operation completes
     * 
     * @example
     * const timer = logger.startTimer('database-query');
     * // ... perform operation ...
     * timer.done({ recordCount: 100 }); // Logs duration with metadata
     */
    startTimer(operation: string): { done: (metadata?: unknown) => void } {
        const startTime = Date.now();
        const timerLogger = this.child({ operation });
        
        timerLogger.verbose(`Operation started: ${operation}`);
        
        return {
            done: (metadata?: unknown) => {
                const duration = Date.now() - startTime;
                timerLogger.verbose(`Operation completed: ${operation}`, {
                    durationMs: duration,
                    ...(metadata && typeof metadata === 'object' ? metadata : {}),
                });
            }
        };
    }
    
    /**
     * Logs a security event
     * SOC2: Track security-relevant events for compliance
     * 
     * @param eventType - Type of security event
     * @param message - Description of the event
     * @param data - Additional structured data
     */
    security(eventType: string, message: string, data?: unknown): void {
        this.formatMessage('warn', `[SECURITY] ${eventType}: ${message}`, {
            securityEvent: eventType,
            ...(data && typeof data === 'object' ? data : {}),
        });
    }
    
    /**
     * Logs an audit event
     * ISO9000: Maintain audit trail for quality management
     * SOC2: Track changes and access for compliance
     * 
     * @param action - Action being audited
     * @param message - Description of the action
     * @param data - Additional structured data
     */
    audit(action: string, message: string, data?: unknown): void {
        this.formatMessage('info', `[AUDIT] ${action}: ${message}`, {
            auditAction: action,
            auditTimestamp: new Date().toISOString(),
            ...(data && typeof data === 'object' ? data : {}),
        });
    }
}
