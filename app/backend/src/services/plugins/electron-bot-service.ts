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
import { groupEntriesByQuarter, getQuarterForDate } from '../bot/src/quarter_config';
import { createFormConfig } from '../bot/src/automation_config';
import { botLogger } from '../../../../shared/logger';

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
  public async submit(entries: TimesheetEntry[], credentials: Credentials, progressCallback?: (percent: number, message: string) => void, abortSignal?: AbortSignal, useMockWebsite?: boolean): Promise<SubmissionResult> {
    botLogger.info('Starting Electron submission', { entryCount: entries.length });
    
    try {
      // Check if aborted before starting
      if (abortSignal?.aborted) {
        botLogger.info('Submission aborted before starting');
        return {
          ok: false,
          submittedIds: [],
          removedIds: [],
          totalProcessed: entries.length,
          successCount: 0,
          removedCount: 0,
          error: 'Submission was cancelled'
        };
      }
      // Debug: Check each entry's quarter
      botLogger.debug('Checking entries for quarter assignment', {
        entries: entries.map(entry => ({
          id: entry.id,
          date: entry.date,
          quarter: getQuarterForDate(entry.date)?.id || 'NONE'
        }))
      });
      
      // Group entries by quarter (needed for form configuration)
      const quarterGroups = groupEntriesByQuarter(entries);
      botLogger.verbose('Entries grouped by quarter', { quarterCount: quarterGroups.size });
      
      const allSubmittedIds: number[] = [];
      const allFailedIds: number[] = [];
      let overallSuccess = true;
      
      // Process each quarter separately with appropriate form configuration
      for (const [quarterId, quarterEntries] of Array.from(quarterGroups.entries())) {
        botLogger.info('Processing quarter', { 
          quarterId, 
          entryCount: quarterEntries.length 
        });
        
        // Get quarter definition for form configuration
        const quarterDef = quarterEntries[0] ? getQuarterForDate(quarterEntries[0].date) : null;
        if (!quarterDef) {
          botLogger.error('Could not determine quarter for entries', { 
            firstDate: quarterEntries[0]?.date,
            dates: quarterEntries.map(e => e.date) 
          });
          // If we can't determine the quarter, skip these entries
          quarterEntries.forEach(entry => {
            if (entry.id) allFailedIds.push(entry.id);
          });
          overallSuccess = false;
          continue;
        }
        
        // Create form configuration for this quarter
        // If useMockWebsite is true, override URLs to point to mock website
        let formConfig;
        if (useMockWebsite) {
          const mockBaseUrl = process.env.MOCK_WEBSITE_URL || 'http://localhost:3000';
          const mockFormId = process.env.MOCK_FORM_ID || '0197cbae7daf72bdb96b3395b500d414';
          botLogger.info('Using mock website for submission', { mockBaseUrl, mockFormId });
          
          // Create custom form config for mock website with localhost URL patterns
          // BASE_URL should be root URL so bot can navigate through login flow
          const mockDomain = mockBaseUrl.replace(/^https?:\/\//, '');
          formConfig = {
            BASE_URL: mockBaseUrl,
            FORM_ID: mockFormId,
            SUBMISSION_ENDPOINT: `${mockBaseUrl}/api/submit/${mockFormId}`,
            SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: [
              `**${mockDomain}/api/submit/**`,
              `**${mockDomain}/**`
            ]
          };
        } else {
          formConfig = createFormConfig(quarterDef.formUrl, quarterDef.formId);
        }
        
        // Convert entries to bot format
        const ids = quarterEntries.map(e => e.id).filter((id): id is number => id !== undefined);
        const botRows = quarterEntries.map(entry => this.toBotRow(entry));
        botLogger.debug('Converted to bot format', { idMappings: ids });
        
        // Run browser automation for this quarter
        botLogger.verbose('Starting bot automation', { 
          formUrl: formConfig.BASE_URL,
          formId: formConfig.FORM_ID
        });
        // Check if aborted before running this quarter
        if (abortSignal?.aborted) {
          botLogger.info('Submission aborted during quarter processing', { quarterId });
          throw new Error('Submission was cancelled');
        }
        
        const { ok, submitted, errors } = await runTimesheet(
          botRows,
          credentials.email,
          credentials.password,
          formConfig,
          progressCallback,
          undefined,
          abortSignal
        );
        botLogger.info('Bot automation completed', { 
          ok, 
          submittedCount: submitted.length, 
          errorCount: errors.length 
        });
        
        // Log errors from bot
        if (errors.length > 0) {
          botLogger.error('Bot returned errors during submission', { 
            errorCount: errors.length, 
            errors 
          });
        }
        
        // Map bot indices back to entry IDs
        botLogger.debug('Bot returned indices', { 
          submitted, 
          errors,
          idsArray: ids
        });
        
        const submittedIds = submitted
          .filter(i => i >= 0 && i < ids.length)
          .map(i => ids[i])
          .filter((id): id is number => id !== undefined);
        
        const failedIds = errors
          .filter(([i]) => i >= 0 && i < ids.length)
          .map(([i]) => ids[i])
          .filter((id): id is number => id !== undefined);
        
        botLogger.info('Mapped bot results to IDs', { 
          submittedIndices: submitted,
          submittedIds, 
          failedIndices: errors.map(([i]) => i),
          failedIds,
          totalIds: ids.length
        });
        
        allSubmittedIds.push(...submittedIds);
        allFailedIds.push(...failedIds);
        
        if (!ok) {
          overallSuccess = false;
        }
      }
      
      const result = {
        ok: overallSuccess,
        submittedIds: allSubmittedIds,
        removedIds: allFailedIds,
        totalProcessed: entries.length,
        successCount: allSubmittedIds.length,
        removedCount: allFailedIds.length
      };
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

