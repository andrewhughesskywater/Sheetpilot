/**
 * @fileoverview Content Security Policy (CSP) Violation Reporting
 * 
 * Handles CSP violation reports from the renderer process with rate limiting
 * to prevent log flooding while maintaining security visibility.
 * 
 * Rate limiting: Maximum 3 violations per directive per hour per source.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2026
 */

import { ipcMain } from 'electron';
import { ipcLogger } from './utils/logger';

interface CSPViolation {
  directive: string;
  blockedURI: string;
  violatedDirective: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

interface _RateLimitKey {
  directive: string;
  blockedURI: string;
  sourceFile: string;
}

interface RateLimitEntry {
  count: number;
  firstViolation: number;
  lastViolation: number;
}

// Rate limiter: Track violations per directive/URI/source combination
const violationTracker = new Map<string, RateLimitEntry>();
const MAX_VIOLATIONS_PER_HOUR = 3;
const HOUR_IN_MS = 60 * 60 * 1000;

/**
 * Generate a cache key for rate limiting
 */
function getRateLimitKey(violation: CSPViolation): string {
  return `${violation.directive}|${violation.blockedURI}|${violation.sourceFile || 'unknown'}`;
}

/**
 * Check if violation should be logged based on rate limit
 * Returns true if violation should be logged, false if rate-limited
 */
function shouldLogViolation(violation: CSPViolation): boolean {
  const key = getRateLimitKey(violation);
  const now = Date.now();
  const entry = violationTracker.get(key);

  // First violation for this key
  if (!entry) {
    violationTracker.set(key, {
      count: 1,
      firstViolation: now,
      lastViolation: now,
    });
    return true;
  }

  // Check if hour window has passed since first violation
  const hourElapsed = now - entry.firstViolation >= HOUR_IN_MS;
  
  if (hourElapsed) {
    // Reset counter for new hour window
    violationTracker.set(key, {
      count: 1,
      firstViolation: now,
      lastViolation: now,
    });
    return true;
  }

  // Within same hour window
  if (entry.count < MAX_VIOLATIONS_PER_HOUR) {
    entry.count++;
    entry.lastViolation = now;
    return true;
  }

  // Rate limit exceeded - log only on first suppression
  if (entry.count === MAX_VIOLATIONS_PER_HOUR) {
    entry.count++; // Increment to mark as "suppression logged"
    ipcLogger.warn('CSP violation rate limit exceeded - suppressing further logs for 1 hour', {
      directive: violation.directive,
      blockedURI: violation.blockedURI,
      sourceFile: violation.sourceFile,
      suppressedSince: new Date(entry.lastViolation).toISOString(),
    });
  }

  return false;
}

/**
 * Clean up old entries from violation tracker (prevents memory leak)
 */
function cleanupViolationTracker(): void {
  const now = Date.now();
  const cutoff = now - HOUR_IN_MS;

  for (const [key, entry] of violationTracker.entries()) {
    if (entry.lastViolation < cutoff) {
      violationTracker.delete(key);
    }
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupViolationTracker, 15 * 60 * 1000);

/**
 * Register CSP violation reporting handler
 */
export function registerCSPHandlers(): void {
  ipcMain.handle('csp:report-violation', async (_event, violation: CSPViolation) => {
    try {
      // Validate violation object
      if (!violation || typeof violation !== 'object') {
        ipcLogger.warn('Received invalid CSP violation report', { violation });
        return { success: false, error: 'Invalid violation format' };
      }

      // Rate-limited logging
      if (shouldLogViolation(violation)) {
        ipcLogger.warn('CSP violation detected', {
          directive: violation.directive,
          blockedURI: violation.blockedURI,
          violatedDirective: violation.violatedDirective,
          sourceFile: violation.sourceFile,
          lineNumber: violation.lineNumber,
          columnNumber: violation.columnNumber,
        });
      }

      return { success: true };
    } catch (error: unknown) {
      ipcLogger.error('Failed to process CSP violation report', {
        error: error instanceof Error ? error.message : String(error),
        violation,
      });
      return { success: false, error: 'Failed to process violation' };
    }
  });

  ipcLogger.verbose('CSP handlers registered');
}
