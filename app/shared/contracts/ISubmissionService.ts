/**
 * @fileoverview Submission Service Contract
 * 
 * Defines the interface for timesheet submission operations.
 * Any submission implementation (browser automation, API, etc.) must implement this interface.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { IPlugin } from '../plugin-types';
import type { TimesheetEntry } from './IDataService';
import type { Credentials } from './ICredentialService';

/**
 * Validation result for a timesheet entry
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Submission result for timesheet entries
 */
export interface SubmissionResult {
  ok: boolean;
  submittedIds: number[];
  removedIds: number[];
  totalProcessed: number;
  successCount: number;
  removedCount: number;
  error?: string;
}

/**
 * Submission service interface for submitting timesheet entries
 * Implementations handle the actual submission process (browser automation, API calls, etc.)
 */
export interface ISubmissionService extends IPlugin {
  /**
   * Submit timesheet entries using provided credentials
   * @param entries Array of timesheet entries to submit
   * @param credentials Authentication credentials
   * @param progressCallback Optional callback for progress updates (percent, message)
   * @param abortSignal Optional abort signal for cancellation support
   * @returns Result of submission operation
   */
  submit(entries: TimesheetEntry[], credentials: Credentials, progressCallback?: (percent: number, message: string) => void, abortSignal?: {aborted: boolean; reason?: unknown}): Promise<SubmissionResult>;

  /**
   * Validate a timesheet entry before submission
   * @param entry Timesheet entry to validate
   * @returns Validation result
   */
  validateEntry(entry: TimesheetEntry): ValidationResult;

  /**
   * Check if the submission service is available
   * @returns True if service can be used
   */
  isAvailable(): Promise<boolean>;
}

