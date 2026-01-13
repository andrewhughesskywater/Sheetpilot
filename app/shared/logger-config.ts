/**
 * @fileoverview Logger Configuration
 * 
 * Configures electron-log transports, levels, and formats.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-09-30
 */

import log from 'electron-log';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { createFileFormat, createConsoleFormat } from './logger-formatters';

/**
 * Current user name for audit trail and user-specific logging
 * SOC2: PII handling - username hashed in production unless SHEETPILOT_LOG_USERNAME=true
 */
const CURRENT_USER = os.userInfo().username;

/**
 * Stored log path for retrieval without calling resolvePathFn
 * Set during configureFileTransport
 */
let storedLogPath: string | undefined;

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
 * Configure file transport settings
 * @private
 */
function configureFileTransport(SESSION_ID: string): void {
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
export function configureLogger(
    SESSION_ID: string,
    getLogUsername: () => string,
    ENVIRONMENT: string
): void {
    configureLogLevels();
    configureFileTransport(SESSION_ID);
    
    // Machine-parsable JSON format for log aggregation
    // Enables automated monitoring, alerting, and compliance reporting
    log.transports.file.format = createFileFormat(SESSION_ID, getLogUsername, ENVIRONMENT);
    
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

/**
 * Get the stored log path
 */
export function getStoredLogPath(): string | undefined {
    return storedLogPath;
}
