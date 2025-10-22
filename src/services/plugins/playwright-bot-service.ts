/**
 * @fileoverview Playwright Bot Service Plugin
 * 
 * Implementation of ISubmissionService using Playwright browser automation.
 * Wraps the existing bot orchestration system.
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
import { runTimesheet } from '../bot/src/index';

/**
 * Playwright-based submission service using browser automation
 */
export class PlaywrightBotService implements ISubmissionService {
  public readonly metadata: PluginMetadata = {
    name: 'playwright',
    version: '1.1.2',
    author: 'Andrew Hughes',
    description: 'Playwright-based browser automation submission service'
  };

  /**
   * Convert TimesheetEntry to bot row format
   */
  private toBotRow(entry: TimesheetEntry): Record<string, string | number | null | undefined> {
    // Convert date from YYYY-MM-DD to mm/dd/yyyy format for bot
    const dateParts = entry.date.split('-');
    const formattedDate = dateParts.length === 3 
      ? `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}`
      : entry.date;
    
    // Calculate hours from time_in and time_out
    const timeInParts = entry.timeIn.split(':');
    const timeOutParts = entry.timeOut.split(':');
    
    const timeInMinutes = parseInt(timeInParts[0] || '0', 10) * 60 + parseInt(timeInParts[1] || '0', 10);
    const timeOutMinutes = parseInt(timeOutParts[0] || '0', 10) * 60 + parseInt(timeOutParts[1] || '0', 10);
    const hours = (timeOutMinutes - timeInMinutes) / 60.0;
    
    return {
      Project: entry.project,
      Date: formattedDate,
      Hours: hours,
      Tool: entry.tool ?? '',
      'Task Description': entry.taskDescription,
      'Detail Charge Code': entry.chargeCode ?? '',
      Status: '' // Bot will skip rows with Status === 'Complete'
    };
  }

  /**
   * Submit timesheet entries using browser automation
   */
  public async submit(entries: TimesheetEntry[], credentials: Credentials): Promise<SubmissionResult> {
    try {
      // Convert entries to bot format
      const botRows = entries.map(entry => this.toBotRow(entry));
      
      // Run browser automation
      const { ok, submitted, errors } = await runTimesheet(
        botRows,
        credentials.email,
        credentials.password
      );
      
      // Map bot indices back to entry IDs
      const submittedIds = submitted
        .map(i => entries[i]?.id)
        .filter((id): id is number => id !== undefined);
      
      const failedIds = errors
        .filter(([i]) => i >= 0 && i < entries.length)
        .map(([i]) => entries[i]?.id)
        .filter((id): id is number => id !== undefined);
      
      return {
        ok,
        submittedIds,
        removedIds: failedIds,
        totalProcessed: entries.length,
        successCount: submittedIds.length,
        removedCount: failedIds.length
      };
    } catch (error) {
      return {
        ok: false,
        submittedIds: [],
        removedIds: [],
        totalProcessed: entries.length,
        successCount: 0,
        removedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate a timesheet entry
   */
  public validateEntry(entry: TimesheetEntry): ValidationResult {
    const errors: string[] = [];
    
    // Validate date
    if (!entry.date) {
      errors.push('Date is required');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
      errors.push('Date must be in YYYY-MM-DD format');
    }
    
    // Validate time
    if (!entry.timeIn) {
      errors.push('Start time is required');
    } else if (!/^\d{1,2}:\d{2}$/.test(entry.timeIn)) {
      errors.push('Start time must be in HH:MM format');
    }
    
    if (!entry.timeOut) {
      errors.push('End time is required');
    } else if (!/^\d{1,2}:\d{2}$/.test(entry.timeOut)) {
      errors.push('End time must be in HH:MM format');
    }
    
    // Validate times are 15-minute increments
    if (entry.timeIn && entry.timeOut) {
      const timeInParts = entry.timeIn.split(':');
      const timeOutParts = entry.timeOut.split(':');
      
      const timeInMinutes = parseInt(timeInParts[0] || '0', 10) * 60 + parseInt(timeInParts[1] || '0', 10);
      const timeOutMinutes = parseInt(timeOutParts[0] || '0', 10) * 60 + parseInt(timeOutParts[1] || '0', 10);
      
      if (timeInMinutes % 15 !== 0 || timeOutMinutes % 15 !== 0) {
        errors.push('Times must be in 15-minute increments');
      }
      
      if (timeOutMinutes <= timeInMinutes) {
        errors.push('End time must be after start time');
      }
    }
    
    // Validate project
    if (!entry.project) {
      errors.push('Project is required');
    }
    
    // Validate task description
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
    // Browser automation is always available in this implementation
    return true;
  }
}

