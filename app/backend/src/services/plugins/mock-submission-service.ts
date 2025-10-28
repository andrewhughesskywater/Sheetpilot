/**
 * @fileoverview Mock Submission Service Plugin
 * 
 * Mock implementation of ISubmissionService for testing without browser automation.
 * Simulates submission process without actually submitting anything.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type {
  ISubmissionService,
  SubmissionResult,
  ValidationResult
} from '../../shared/contracts/ISubmissionService';
import type { TimesheetEntry } from '../../shared/contracts/IDataService';
import type { Credentials } from '../../shared/contracts/ICredentialService';
import type { PluginMetadata } from '../../shared/plugin-types';

/**
 * Mock submission service for testing
 */
export class MockSubmissionService implements ISubmissionService {
  public readonly metadata: PluginMetadata = {
    name: 'mock',
    version: '1.1.2',
    author: 'Andrew Hughes',
    description: 'Mock submission service for testing'
  };

  private shouldFail: boolean = false;
  private failureRate: number = 0;

  /**
   * Set whether submissions should fail
   */
  public setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  /**
   * Set the failure rate (0.0 to 1.0)
   */
  public setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Submit timesheet entries (mock implementation)
   */
  public async submit(entries: TimesheetEntry[], _credentials: Credentials): Promise<SubmissionResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    if (this.shouldFail) {
      return {
        ok: false,
        submittedIds: [],
        removedIds: entries.map(e => e.id!).filter(id => id !== undefined),
        totalProcessed: entries.length,
        successCount: 0,
        removedCount: entries.length,
        error: 'Mock submission service configured to fail'
      };
    }

    // Simulate partial failures based on failure rate
    const submittedIds: number[] = [];
    const removedIds: number[] = [];

    for (const entry of entries) {
      if (!entry.id) continue;

      const shouldFailThisEntry = Math.random() < this.failureRate;
      if (shouldFailThisEntry) {
        removedIds.push(entry.id);
      } else {
        submittedIds.push(entry.id);
      }
    }

    return {
      ok: removedIds.length === 0,
      submittedIds,
      removedIds,
      totalProcessed: entries.length,
      successCount: submittedIds.length,
      removedCount: removedIds.length
    };
  }

  /**
   * Validate a timesheet entry
   */
  public validateEntry(entry: TimesheetEntry): ValidationResult {
    const errors: string[] = [];
    
    if (!entry.date) {
      errors.push('Date is required');
    }
    
    if (!entry.timeIn) {
      errors.push('Start time is required');
    }
    
    if (!entry.timeOut) {
      errors.push('End time is required');
    }
    
    if (!entry.project) {
      errors.push('Project is required');
    }
    
    if (!entry.taskDescription) {
      errors.push('Task description is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if the submission service is available
   */
  public async isAvailable(): Promise<boolean> {
    return true;
  }
}

