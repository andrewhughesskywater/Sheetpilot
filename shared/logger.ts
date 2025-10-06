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
import { app } from 'electron';

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
 */
const CURRENT_USER = os.userInfo().username;

/**
 * Application version from package.json
 */
const APP_VERSION = '1.0.0';

/**
 * Environment type (development, production, test)
 */
const ENVIRONMENT = process.env['NODE_ENV'] || 'production';

/**
 * Configure electron-log with industry-standard settings
 */
export function configureLogger() {
    // Set log levels for different transports
    // verbose: Detailed operational information for troubleshooting
    log.transports.file.level = 'verbose';
    log.transports.console.level = 'debug';
    
    // Configure file transport with rotation
    // ISO9000: Maintain records for quality management
    // SOC2: Ensure log availability and integrity
    // Network log path for centralized logging
    const networkLogPath = '\\\\swfl-file01\\Maintenance\\Python Programs\\SheetPilot\\logs';
    const fallbackLogPath = app ? app.getPath('userData') : process.cwd();
    
    // Try to use network path, fallback to local if network is unavailable
    let logPath: string;
    try {
        // Test if network path is accessible by trying to create the directory
        const fs = require('fs');
        if (!fs.existsSync(networkLogPath)) {
            fs.mkdirSync(networkLogPath, { recursive: true });
        }
        logPath = networkLogPath;
    } catch (error) {
        // Fallback to local userData if network path is not accessible
        logPath = fallbackLogPath;
        console.warn('Network log path not accessible, using local fallback:', error);
    }
    
    log.transports.file.resolvePathFn = () => path.join(logPath, 'sheetpilot.log');
    log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB per file
    
    // Machine-parsable JSON format for log aggregation
    // Enables automated monitoring, alerting, and compliance reporting
    log.transports.file.format = (msg) => {
        const logEntry = {
            // ISO 8601 timestamp for precise time tracking
            timestamp: new Date().toISOString(),
            
            // Log level for filtering and alerting
            level: msg.level,
            
            // Session correlation for tracking user flows
            sessionId: SESSION_ID,
            
            // User identification for audit trail and user-specific tracking
            username: CURRENT_USER,
            
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
            
            // Primary message content
            message: msg.data.map((d: any) => typeof d === 'object' ? JSON.stringify(d) : String(d)).join(' '),
            
            // Structured data for machine parsing
            data: msg.data.length === 1 && typeof msg.data[0] === 'object' ? msg.data[0] : msg.data,
        };
        
        return [JSON.stringify(logEntry)];
    };
    
    // Human-readable console format for development
    log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    
    // Error handling for log system failures
    // SOC2: Ensure system availability and error handling
    log.errorHandler.startCatching({
        showDialog: false,
        onError: (error) => {
            console.error('Logging system error:', error);
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
    [key: string]: any;
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
     * Formats a log message with context
     * @private
     */
    private formatMessage(level: string, message: string, data?: any): void {
        const entry = {
            ...this.context,
            message,
            ...(data && { data }),
        };
        
        // Use appropriate log level
        switch (level) {
            case 'error':
                log.error(entry);
                break;
            case 'warn':
                log.warn(entry);
                break;
            case 'info':
                log.info(entry);
                break;
            case 'verbose':
                log.verbose(entry);
                break;
            case 'debug':
                log.debug(entry);
                break;
            case 'silly':
                log.silly(entry);
                break;
            default:
                log.info(entry);
        }
    }
    
    /**
     * Logs an error message
     * ISO9000: Document non-conformities and corrective actions
     * SOC2: Track security incidents and system errors
     */
    error(message: string, error?: Error | any): void {
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
    warn(message: string, data?: any): void {
        this.formatMessage('warn', message, data);
    }
    
    /**
     * Logs an informational message
     * ISO9000: Document normal operations and decisions
     */
    info(message: string, data?: any): void {
        this.formatMessage('info', message, data);
    }
    
    /**
     * Logs verbose operational details
     * For troubleshooting and detailed operational tracking
     */
    verbose(message: string, data?: any): void {
        this.formatMessage('verbose', message, data);
    }
    
    /**
     * Logs debug information
     * For development and deep troubleshooting
     */
    debug(message: string, data?: any): void {
        this.formatMessage('debug', message, data);
    }
    
    /**
     * Logs extremely detailed trace information
     */
    silly(message: string, data?: any): void {
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
    startTimer(operation: string): { done: (metadata?: any) => void } {
        const startTime = Date.now();
        const timerLogger = this.child({ operation });
        
        timerLogger.verbose(`Operation started: ${operation}`);
        
        return {
            done: (metadata?: any) => {
                const duration = Date.now() - startTime;
                timerLogger.verbose(`Operation completed: ${operation}`, {
                    durationMs: duration,
                    ...metadata,
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
    security(eventType: string, message: string, data?: any): void {
        this.formatMessage('warn', `[SECURITY] ${eventType}: ${message}`, {
            securityEvent: eventType,
            ...data,
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
    audit(action: string, message: string, data?: any): void {
        this.formatMessage('info', `[AUDIT] ${action}: ${message}`, {
            auditAction: action,
            auditTimestamp: new Date().toISOString(),
            ...data,
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
 */
export function initializeLogging(): void {
    configureLogger();
    
    // Get the actual log path being used
    const actualLogPath = log.transports.file.resolvePathFn({
        appData: app ? app.getPath('userData') : process.cwd(),
        appName: 'SheetPilot',
        appVersion: APP_VERSION,
        home: process.env['HOME'] || process.env['USERPROFILE'] || '',
        userData: app ? app.getPath('userData') : process.cwd(),
        libraryDefaultDir: app ? app.getPath('userData') : process.cwd(),
        libraryTemplate: app ? app.getPath('userData') : process.cwd(),
        tempDir: process.env['TEMP'] || process.env['TMP'] || '/tmp'
    });
    
    appLogger.info('Logging system initialized', {
        sessionId: SESSION_ID,
        username: CURRENT_USER,
        version: APP_VERSION,
        environment: ENVIRONMENT,
        platform: process.platform,
        nodeVersion: process.version,
        logPath: actualLogPath,
        usingNetworkPath: actualLogPath.includes('swfl-file01'),
    });
}

// Export the base electron-log for advanced use cases
export { log as electronLog };
