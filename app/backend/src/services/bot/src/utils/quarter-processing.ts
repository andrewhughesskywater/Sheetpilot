/**
 * @fileoverview Quarter Processing Utilities
 * 
 * Shared utilities for processing timesheet entries grouped by quarter.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { TimesheetEntry } from '../../../../../../shared/contracts/IDataService';
import type { SubmissionResult } from '../../../../../../shared/contracts/ISubmissionService';
import { getQuarterForDate, groupEntriesByQuarter } from '../quarter_config';
import { createFormConfig } from '../automation_config';
import { botLogger } from '../../../../../../shared/logger';
import { checkAborted } from './abort-utils';

/**
 * Configuration for processing a quarter group
 */
export interface QuarterProcessingConfig {
  /** Function to convert entries to bot row format */
  toBotRow: (entry: TimesheetEntry) => Record<string, string | number | null | undefined>;
  /** Function to run the bot automation */
  runBot: (
    botRows: Array<Record<string, unknown>>,
    email: string,
    password: string,
    formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] },
    progressCallback?: (percent: number, message: string) => void,
    headless?: boolean,
    abortSignal?: AbortSignal
  ) => Promise<{ ok: boolean; submitted: number[]; errors: Array<[number, string]> }>;
  /** Email for authentication */
  email: string;
  /** Password for authentication */
  password: string;
  /** Optional progress callback */
  progressCallback?: ((percent: number, message: string) => void) | undefined;
  /** Optional abort signal */
  abortSignal?: AbortSignal | undefined;
  /** Whether to use mock website */
  useMockWebsite?: boolean | undefined;
}

/**
 * Processes timesheet entries grouped by quarter
 * @param entries - Array of timesheet entries to process
 * @param config - Configuration for processing
 * @returns Promise resolving to submission result
 */
export async function processEntriesByQuarter(
  entries: TimesheetEntry[],
  config: QuarterProcessingConfig
): Promise<SubmissionResult> {
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
    let formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] };
    if (config.useMockWebsite) {
      const mockBaseUrl = process.env['MOCK_WEBSITE_URL'] || 'http://localhost:3000';
      const mockFormId = process.env['MOCK_FORM_ID'] || '0197cbae7daf72bdb96b3395b500d414';
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
    const botRows = quarterEntries.map(entry => config.toBotRow(entry));
    botLogger.debug('Converted to bot format', { idMappings: ids });
    
    // Run browser automation for this quarter
    botLogger.verbose('Starting bot automation', { 
      formUrl: formConfig.BASE_URL,
      formId: formConfig.FORM_ID
    });
    
    // Check if aborted before running this quarter
    try {
      checkAborted(config.abortSignal, `Submission (quarter ${quarterId})`);
    } catch {
      botLogger.info('Submission aborted during quarter processing', { quarterId });
      throw new Error('Submission was cancelled');
    }
    
        const { ok, submitted, errors } = await config.runBot(
          botRows,
          config.email,
          config.password,
          formConfig,
          config.progressCallback ?? undefined,
          undefined,
          config.abortSignal ?? undefined
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
  
  return {
    ok: overallSuccess,
    submittedIds: allSubmittedIds,
    removedIds: allFailedIds,
    totalProcessed: entries.length,
    successCount: allSubmittedIds.length,
    removedCount: allFailedIds.length
  };
}

