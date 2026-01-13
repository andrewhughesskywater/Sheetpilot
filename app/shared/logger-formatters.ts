/**
 * @fileoverview Log Formatting Functions
 * 
 * Provides formatting functions for file and console log outputs.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-09-30
 */

import { APP_VERSION } from './constants';

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
export function createFileFormat(
    SESSION_ID: string,
    getLogUsername: () => string,
    ENVIRONMENT: string
): (msg: { level: string; data: unknown[] }) => string[] {
    const formatContextForDisplay = (context: Record<string, unknown>): string => {
        const parts: string[] = [];
        for (const [key, value] of Object.entries(context)) {
            if (value === undefined) {
                continue;
            }
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
                parts.push(`${key}=${String(value)}`);
                continue;
            }
            if (value instanceof Error) {
                parts.push(`${key}=${value.name}:${value.message}`);
                continue;
            }
            try {
                parts.push(`${key}=${JSON.stringify(value)}`);
            } catch {
                parts.push(`${key}=[unserializable]`);
            }
        }
        return parts.join(' ');
    };

    return (msg: { level: string; data: unknown[] }) => {
        const { message, context, component } = extractMessageAndContext(msg.data);
        
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

        if (component !== undefined && component.length > 0) {
            logEntry['component'] = component;
        }
        
        // Add context as separate field if present
        if (context) {
            logEntry['context'] = context;
        }

        // Human-readable single-field view (still structured NDJSON overall)
        // Keep one-line output to preserve NDJSON and machine-parsability.
        const levelUpper = msg.level.toUpperCase();
        const displayComponent = component !== undefined && component.length > 0 ? component : 'Application';
        const displayContext = context ? formatContextForDisplay(context) : '';
        logEntry['display'] = displayContext.length > 0
            ? `[${levelUpper}] [${displayComponent}] ${message} | ${displayContext}`
            : `[${levelUpper}] [${displayComponent}] ${message}`;
        
        return [JSON.stringify(logEntry)];
    };
}

/**
 * Create console format function for human-readable or JSON logging
 * @private
 */
export function createConsoleFormat(): (msg: { level: string; data: unknown[] }) => string[] {
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
