/**
 * @fileoverview Electron Bot Service Plugin
 * 
 * Implementation of ISubmissionService using Electron BrowserWindow browser automation.
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
} from '../../../../shared/contracts/ISubmissionService';
import type { TimesheetEntry } from '../../../../shared/contracts/IDataService';
import type { Credentials } from '../../../../shared/contracts/ICredentialService';
import type { PluginMetadata } from '../../../../shared/plugin-types';
import { runTimesheet } from '../bot/src/index';
import { botLogger } from '../../../../shared/logger';
import { checkAborted, createCancelledResult } from '../bot/src/utils/abort-utils';
import { processEntriesByQuarter } from '../bot/src/utils/quarter-processing';
import {
  parseTimeToMinutes,
  convertDateToUSFormat
} from '../../../../shared/utils/format-conversions';

/**
 * Electron-based submission service using browser automation
 */
export class ElectronBotService implements ISubmissionService {
  public readonly metadata: PluginMetadata = {
    name: 'electron',
    version: '1.2.5',
    author: 'Andrew Hughes',
    description: 'Electron BrowserWindow-based browser automation submission service'
  };

  /**
   * Convert TimesheetEntry to bot row format
   */
  private toBotRow(entry: TimesheetEntry): Record<string, string | number | null | undefined> {
    // Convert date from YYYY-MM-DD to mm/dd/yyyy format for bot
    const formattedDate = convertDateToUSFormat(entry.date);
    
    // Calculate hours from time_in and time_out
    const timeInMinutes = parseTimeToMinutes(entry.timeIn);
    const timeOutMinutes = parseTimeToMinutes(entry.timeOut);
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
  public async submit(entries: TimesheetEntry[], credentials: Credentials, progressCallback?: (percent: number, message: string) => void, abortSignal?: AbortSignal, useMockWebsite?: boolean): Promise<SubmissionResult> {
    botLogger.info('Starting Electron submission', { entryCount: entries.length });
    
    try {
      // Check if aborted before starting
      try {
        checkAborted(abortSignal, 'Submission');
      } catch {
        return createCancelledResult(entries.length);
      }
      const result = await processEntriesByQuarter(entries, {
        toBotRow: (entry) => this.toBotRow(entry),
        runBot: runTimesheet,
        email: credentials.email,
        password: credentials.password,
        progressCallback,
        abortSignal,
        useMockWebsite
      });
      
      botLogger.info('Electron submission completed', result);
      return result;
    } catch (error) {
      botLogger.error('Exception during Electron submission', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
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

