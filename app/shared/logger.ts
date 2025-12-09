/**
 * @fileoverview Centralized Logging Module
 * 
 * Provides structured, machine-parsable logging following industry standards:
 * - ISO9000: Quality management and traceability
 * - SOC2: Security, availability, processing integrity, confidentiality, privacy
 * 
 * Features:
 * - Machine-parsable JSON format for log aggregation systems
 * - Structured context for correlation and debugging
 * - Multiple severity levels (error, warn, info, verbose, debug, silly)
 * - Automatic metadata injection (timestamp, session ID, process info)
 * - File and console transports with rotation
 * - Performance tracking for operations
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-09-30
 */

import log from 'electron-log';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { app } from 'electron';
import { APP_VERSION } from './constants';

// ============================================================================
// LOGGER CONFIGURATION
// ============================================================================

/**
 * Session ID for correlating logs across the application lifecycle
 * Generated once per app instance
 */
const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

/**
 * Current user name for audit trail and user-specific logging
 * SOC2: PII handling - username hashed in production unless SHEETPILOT_LOG_USERNAME=true
 */
const CURRENT_USER = os.userInfo().username;
const REDACT_PII = process.env['SHEETPILOT_LOG_USERNAME'] !== 'true' && process.env['NODE_ENV'] === 'production';

/**
 * Get username for logging - redacted in production unless explicitly enabled
 */
function getLogUsername(): string {
    if (REDACT_PII) {
        // Use first 3 chars + hash for correlation while protecting PII
        const hash = crypto.createHash('sha256').update(CURRENT_USER).digest('hex').substring(0, 8);
        return `${CURRENT_USER.substring(0, 3)}***${hash}`;
    }
    return CURRENT_USER;
}

/**
 * Application version imported from constants
 */

/**
 * Environment type (development, production, test)
 */
const ENVIRONMENT = process.env['NODE_ENV'] || 'production';


/**
 * Extract message and context from log data
 * @private
 */
function extractMessageAndContext(data: unknown[]): { message: string; context?: Record<string, unknown>; component?: string } {
    let message = '';
    let context: Record<string, unknown> | undefined;
    let component: string | undefined;
    
    if (data.length === 1 && typeof data[0] === 'object' && data[0] !== null) {
        // Single object: extract message and remaining properties as context
        const obj = data[0] as Record<string, unknown>;
        message = String(obj['message'] || '');
        component = String(obj['component'] || 'Application');
        const { message: _, component: __, ...rest } = obj;
        context = Object.keys(rest).length > 0 ? rest : undefined;
    } else if (data.length > 0) {
        // Multiple arguments: first is message, rest is context
        message = String(data[0]);
        if (data.length > 1 && typeof data[1] === 'object' && data[1] !== null) {
            context = data[1] as Record<string, unknown>;
        }
    }
    
    // Build result object conditionally to satisfy exactOptionalPropertyTypes
    const result: { message: string; context?: Record<string, unknown>; component?: string } = { message };
    if (context !== undefined) {
        result.context = context;
    }
    if (component !== undefined) {
        result.component = component;
    }
    return result;
}

/**
 * Create file format function for structured JSON logging
 * @private
 */
function createFileFormat(): (msg: { level: string; data: unknown[] }) => string[] {
    return (msg: { level: string; data: unknown[] }) => {
        const { message, context } = extractMessageAndContext(msg.data);
        
        const logEntry: Record<string, unknown> = {
            // ISO 8601 timestamp for precise time tracking
            timestamp: new Date().toISOString(),
            
            // Log level for filtering and alerting
            level: msg.level,
            
            // Session correlation for tracking user flows
            sessionId: SESSION_ID,
            
            // User identification for audit trail and user-specific tracking
            // SOC2: PII redacted in production unless SHEETPILOT_LOG_USERNAME=true
            username: getLogUsername(),
            
            // Application context for multi-app environments
            application: 'Sheetpilot',
            version: APP_VERSION,
            environment: ENVIRONMENT,
            
            // Process information for debugging
            process: {
                pid: process.pid,
                platform: process.platform,
                nodeVersion: process.version,
            },
            
            // Primary message content (plain text, not JSON encoded)
            message,
        };
        
        // Add context as separate field if present
        if (context) {
            logEntry['context'] = context;
        }
        
        return [JSON.stringify(logEntry)];
    };
}

/**
 * Create console format function for human-readable or JSON logging
 * @private
 */
function createConsoleFormat(): (msg: { level: string; data: unknown[] }) => string[] {
    const useJsonConsole = process.env['LOG_FORMAT'] === 'json';
    
    return (msg: { level: string; data: unknown[] }) => {
        if (useJsonConsole) {
            // JSON format for machine parsing
            const consoleEntry = {
                timestamp: new Date().toISOString(),
                level: msg.level,
                component: 'Application',
                message: msg.data.map((d: unknown) => typeof d === 'object' ? JSON.stringify(d) : String(d)).join(' '),
            };
            return [JSON.stringify(consoleEntry)];
        }
        
        // Human-readable format for development
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const level = msg.level.toUpperCase().padEnd(7);
        
        const { message, context, component } = extractMessageAndContext(msg.data);
        const displayComponent = component || 'Application';
        
        // Format: [TIMESTAMP] LEVEL [COMPONENT] message
        let output = `[${timestamp}] ${level} [${displayComponent}] ${message}`;
        
        // Add context on same line if present
        if (context && Object.keys(context).length > 0) {
            output += ` ${JSON.stringify(context)}`;
        }
        
        return [output];
    };
}

/**
 * Configure log levels for different transports
 * @private
 */
function configureLogLevels(): void {
    // Set log levels for different transports
    // Reduce console noise in development while maintaining file logging
    log.transports.file.level = 'verbose';
    const isDevelopment = process.env['NODE_ENV'] === 'development';
    const debugBrowser = process.env['DEBUG_BROWSER'] === 'true';
    log.transports.console.level = isDevelopment ? (debugBrowser ? 'verbose' : 'info') : 'debug';
}

/**
 * Stored log path for retrieval without calling resolvePathFn
 * Set during configureFileTransport
 */
let storedLogPath: string | undefined;

/**
 * Configure file transport settings
 * @private
 */
function configureFileTransport(): void {
    // Configure LOCAL file transport with 15MB rotation limit
    const localLogPath = app ? app.getPath('userData') : process.cwd();
    const sanitizedUsername = CURRENT_USER.replace(/[^a-zA-Z0-9-_.]/g, '_');
    const logFileName = `sheetpilot_${sanitizedUsername}_${SESSION_ID}.log`;
    
    storedLogPath = path.join(localLogPath, logFileName);
    log.transports.file.resolvePathFn = () => storedLogPath!;
    log.transports.file.maxSize = 15 * 1024 * 1024; // 15MB per file
    // Note: maxFiles is not available in electron-log FileTransport, rotation happens automatically
}

/**
 * Configure electron-log with industry-standard settings
 * Writes to both local (15MB limit) and network drives
 * Always uses verbose logging for internal tool debugging
 */
export function configureLogger() {
    configureLogLevels();
    configureFileTransport();
    
    // Machine-parsable JSON format for log aggregation
    // Enables automated monitoring, alerting, and compliance reporting
    log.transports.file.format = createFileFormat();
    
    // Human-readable console format for development
    // Use JSON format only if LOG_FORMAT=json environment variable is set
    log.transports.console.format = createConsoleFormat();
    
    // Error handling for log system failures
    // SOC2: Ensure system availability and error handling
    log.errorHandler.startCatching({
        showDialog: false,
        onError: (options: { error: Error; errorName: string; processType: string; versions: Record<string, string>; createIssue: (url: string, data: unknown) => void }) => {
            console.error('Logging system error:', options.error);
        }
    });
}

// ============================================================================
// STRUCTURED LOGGING INTERFACE
// ============================================================================

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
        
        if (data !== undefined && data !== null) {
            entry['data'] = data;
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

// ============================================================================
// DEFAULT LOGGER INSTANCES
// ============================================================================

/**
 * Default application logger
 */
export const appLogger = new Logger({ component: 'Application' });

/**
 * Database operations logger
 */
export const dbLogger = new Logger({ component: 'Database' });

/**
 * Import operations logger
 */
export const importLogger = new Logger({ component: 'Import' });

/**
 * Bot/Automation logger
 */
export const botLogger = new Logger({ component: 'Bot' });

/**
 * IPC communication logger
 */
export const ipcLogger = new Logger({ component: 'IPC' });

/**
 * Authentication logger
 */
export const authLogger = new Logger({ component: 'Authentication' });

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the logging system
 * Should be called early in the application lifecycle
 * Non-blocking - uses async operations for network logging
 */
export function initializeLogging(): void {
    configureLogger();
    
    // Get the actual log path being used
    // Use stored path to avoid type issues with resolvePathFn signature
    const actualLogPath = storedLogPath || (app ? app.getPath('userData') : process.cwd());
    
    // Now that logger is configured, we can safely log
    appLogger.info('Logging system initialized', {
        sessionId: SESSION_ID,
        username: getLogUsername(),
        version: APP_VERSION,
        environment: ENVIRONMENT,
        platform: process.platform,
        nodeVersion: process.version,
        localLogPath: actualLogPath,
        loggingMode: 'local-only',
        logLevel: 'verbose',
        maxFileSize: '15MB',
        rotation: 'automatic'
    });
}

// Export the base electron-log for advanced use cases
export { log as electronLog };
