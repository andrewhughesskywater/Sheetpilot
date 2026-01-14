/**
 * @fileoverview Logging Service Contract
 * 
 * Defines the interface for logging operations.
 * Any logging implementation must implement this interface.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { IPlugin } from "@sheetpilot/shared/plugin-types";

/**
 * Log levels
 */
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly'
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

/**
 * Timer interface for performance tracking
 */
export interface Timer {
  /** Stop the timer and log the duration */
  done(metadata?: Record<string, unknown>): void;
}

/**
 * Logging service interface
 * Implementations handle application logging
 */
export interface ILoggingService extends IPlugin {
  /**
   * Log a message at the specified level
   * @param level Log level
   * @param message Log message
   * @param data Optional structured data
   */
  log(level: LogLevel, message: string, data?: unknown): void;

  /**
   * Log an error message
   * @param message Error message
   * @param data Optional error data
   */
  error(message: string, data?: unknown): void;

  /**
   * Log a warning message
   * @param message Warning message
   * @param data Optional warning data
   */
  warn(message: string, data?: unknown): void;

  /**
   * Log an info message
   * @param message Info message
   * @param data Optional info data
   */
  info(message: string, data?: unknown): void;

  /**
   * Log a verbose message
   * @param message Verbose message
   * @param data Optional verbose data
   */
  verbose(message: string, data?: unknown): void;

  /**
   * Log a debug message
   * @param message Debug message
   * @param data Optional debug data
   */
  debug(message: string, data?: unknown): void;

  /**
   * Start a performance timer
   * @param label Timer label
   * @returns Timer instance
   */
  startTimer(label: string): Timer;
}

