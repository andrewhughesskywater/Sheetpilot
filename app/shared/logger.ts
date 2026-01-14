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
import * as os from 'os';
import * as crypto from 'crypto';
import { app } from 'electron';
import { APP_VERSION } from './src/constants';
import { configureLogger, getStoredLogPath } from './logger-config';
import { Logger } from './logger-class';

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



// ============================================================================
// STRUCTURED LOGGING INTERFACE
// ============================================================================

// Re-export Logger class and LogContext interface from logger-class
export { Logger, type LogContext } from './logger-class';

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
    configureLogger(SESSION_ID, getLogUsername, ENVIRONMENT);
    
    // Get the actual log path being used
    // Use stored path to avoid type issues with resolvePathFn signature
    const actualLogPath = getStoredLogPath() || (app ? app.getPath('userData') : process.cwd());
    
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
