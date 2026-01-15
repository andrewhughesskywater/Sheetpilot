/**
 * @fileoverview Session Repository
 * 
 * Handles all session management database operations.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { dbLogger } from '@sheetpilot/shared/logger';
import { getDb } from './connection-manager';

/**
 * Creates a new session for a user
 */
export function createSession(email: string, stayLoggedIn: boolean, isAdmin: boolean = false): string {
    const timer = dbLogger.startTimer('create-session');
    const db = getDb();
    
    try {
        const crypto = require('crypto');
        const sessionToken = crypto.randomUUID();
        
        const expiresAt = stayLoggedIn 
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null;
        
        dbLogger.verbose('Creating session', { email, stayLoggedIn, isAdmin });
        
        const insert = db.prepare(`
            INSERT INTO sessions (session_token, email, expires_at, is_admin)
            VALUES (?, ?, ?, ?)
        `);
        
        insert.run(sessionToken, email, expiresAt, isAdmin ? 1 : 0);
        
        dbLogger.info('Session created successfully', { email, isAdmin });
        timer.done({ sessionCreated: true });
        
        return sessionToken;
    } catch (error) {
        dbLogger.error('Could not create session', error);
        timer.done({ outcome: 'error' });
        throw error;
    }
}

/**
 * Validates a session token
 */
export function validateSession(token: string): { valid: boolean; email?: string; isAdmin?: boolean } {
    const timer = dbLogger.startTimer('validate-session');
    const db = getDb();
    
    try {
        dbLogger.verbose('Validating session', { token: token.substring(0, 8) + '...' });
        
        const getSession = db.prepare(`
            SELECT email, expires_at, is_admin
            FROM sessions
            WHERE session_token = ?
        `);
        
        const session = getSession.get(token) as { email: string; expires_at: string | null; is_admin: number } | undefined;
        
        if (!session) {
            dbLogger.verbose('Session not found');
            timer.done({ valid: false });
            return { valid: false };
        }
        
        // Check if session has expired
        if (session.expires_at) {
            const expiresAt = new Date(session.expires_at);
            // Check if date is valid (invalid dates have isNaN(getTime()))
            if (isNaN(expiresAt.getTime())) {
                dbLogger.verbose('Session has invalid expiration date', { email: session.email, expires_at: session.expires_at });
                clearSession(token);
                timer.done({ valid: false, reason: 'invalid-expiration-date' });
                return { valid: false };
            }
            
            const now = new Date();
            
            if (now > expiresAt) {
                dbLogger.verbose('Session expired', { email: session.email });
                clearSession(token);
                timer.done({ valid: false, reason: 'expired' });
                return { valid: false };
            }
        }
        
        dbLogger.verbose('Session validated successfully', { email: session.email });
        timer.done({ valid: true });
        
        return {
            valid: true,
            email: session.email,
            isAdmin: session.is_admin === 1
        };
    } catch (error) {
        dbLogger.error('Could not validate session', error);
        timer.done({ outcome: 'error' });
        return { valid: false };
    }
}

/**
 * Clears a specific session by token
 */
export function clearSession(token: string): void {
    const timer = dbLogger.startTimer('clear-session');
    const db = getDb();
    
    try {
        dbLogger.verbose('Clearing session', { token: token.substring(0, 8) + '...' });
        
        const deleteSession = db.prepare(`
            DELETE FROM sessions
            WHERE session_token = ?
        `);
        
        const result = deleteSession.run(token);
        
        if (result.changes > 0) {
            dbLogger.info('Session cleared successfully');
        } else {
            dbLogger.verbose('Session not found to clear');
        }
        timer.done({ changes: result.changes });
    } catch (error) {
        dbLogger.error('Could not clear session', error);
        timer.done({ outcome: 'error' });
    }
}

/**
 * Clears all sessions for a specific user
 */
export function clearUserSessions(email: string): void {
    const timer = dbLogger.startTimer('clear-user-sessions');
    const db = getDb();
    
    try {
        dbLogger.verbose('Clearing user sessions', { email });
        
        const deleteSessions = db.prepare(`
            DELETE FROM sessions
            WHERE email = ?
        `);
        
        const result = deleteSessions.run(email);
        
        dbLogger.info('User sessions cleared', { email, count: result.changes });
        timer.done({ changes: result.changes });
    } catch (error) {
        dbLogger.error('Could not clear user sessions', error);
        timer.done({ outcome: 'error' });
    }
}

/**
 * Gets an active session for a user email
 */
export function getSessionByEmail(email: string): string | null {
    const timer = dbLogger.startTimer('get-session-by-email');
    const db = getDb();
    
    try {
        dbLogger.verbose('Getting session by email', { email });
        
        const getSession = db.prepare(`
            SELECT session_token, expires_at
            FROM sessions
            WHERE email = ?
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        const session = getSession.get(email) as { session_token: string; expires_at: string | null } | undefined;
        
        if (!session) {
            timer.done({ found: false });
            return null;
        }
        
        // Check if expired
        if (session.expires_at) {
            const expiresAt = new Date(session.expires_at);
            const now = new Date();
            
            if (now > expiresAt) {
                clearSession(session.session_token);
                timer.done({ found: false, reason: 'expired' });
                return null;
            }
        }
        
        timer.done({ found: true });
        return session.session_token;
    } catch (error) {
        dbLogger.error('Could not get session by email', error);
        timer.done({ outcome: 'error' });
        return null;
    }
}


