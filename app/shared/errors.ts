/**
 * @fileoverview Structured Error Classes
 * 
 * Provides domain-specific error types with context for better error handling,
 * logging, and debugging throughout the application.
 * 
 * All errors follow a consistent structure with:
 * - Clear error codes for programmatic handling
 * - Human-readable messages
 * - Optional contextual metadata
 * - ISO9000/SOC2 compliant error tracking
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-10-01
 */

// Re-export from new location for backward compatibility
export * from './src/types/errors';
