/**
 * Quarter processing helpers for submissions.
 *
 * This module groups `TimesheetEntry` items by quarter, builds the correct form
 * config per quarter, runs the bot, and maps bot result indices back to entry IDs.
 *
 * ## Index → ID mapping
 * `runBot()` returns indices into the `botRows` array. This function builds `ids`
 * in the same order as `botRows`, so `ids[i]` maps bot index `i` to `TimesheetEntry.id`.
 */

import type { TimesheetEntry } from '@sheetpilot/shared/contracts/IDataService';
import type { SubmissionResult } from '@sheetpilot/shared/contracts/ISubmissionService';

import { botLogger } from '../../utils/logger';
import { createFormConfig } from '../config/automation_config';
import { getQuarterForDate, groupEntriesByQuarter } from '../config/quarter_config';
import { checkAborted } from './abort-utils';

/**
 * Configuration for processing a quarter group
 */
export interface QuarterProcessingConfig {
  /** Function to convert entries to bot row format */
  toBotRow: (entry: TimesheetEntry) => Record<string, string | number | null | undefined>;
  /** Function to run the bot automation */
  runBot: (config: {
    rows: Array<Record<string, unknown>>;
    email: string;
    password: string;
    formConfig: {
      BASE_URL: string;
      FORM_ID: string;
      SUBMISSION_ENDPOINT: string;
      SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[];
    };
    progressCallback?: (percent: number, message: string) => void;
    headless?: boolean;
    abortSignal?: AbortSignal | { aborted: boolean; reason?: unknown };
  }) => Promise<{ ok: boolean; submitted: number[]; errors: Array<[number, string]> }>;
  /** Email for authentication */
  email: string;
  /** Password for authentication */
  password: string;
  /** Optional progress callback */
  progressCallback?: ((percent: number, message: string) => void) | undefined;
  /** Optional abort signal (supports both AbortSignal and simplified {aborted: boolean} type) */
  abortSignal?: AbortSignal | { aborted: boolean; reason?: unknown } | undefined;
  /** Whether to use mock website */
  useMockWebsite?: boolean | undefined;
}

type FormConfig = {
  BASE_URL: string;
  FORM_ID: string;
  SUBMISSION_ENDPOINT: string;
  SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[];
};

function buildMockFormConfig(): FormConfig {
  const mockBaseUrl = process.env['MOCK_WEBSITE_URL'] || 'http://localhost:3000';
  const mockFormId = process.env['MOCK_FORM_ID'] || '0197cbae7daf72bdb96b3395b500d414';
  botLogger.info('Using mock website for submission', { mockBaseUrl, mockFormId });

  const mockDomain = mockBaseUrl.replace(/^https?:\/\//, '');
  return {
    BASE_URL: mockBaseUrl,
    FORM_ID: mockFormId,
    SUBMISSION_ENDPOINT: `${mockBaseUrl}/api/submit/${mockFormId}`,
    SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: [`**${mockDomain}/api/submit/**`, `**${mockDomain}/**`],
  };
}

function mapBotResultsToIds(
  ids: number[],
  submitted: number[],
  errors: Array<[number, string]>
): { submittedIds: number[]; failedIds: number[] } {
  const submittedIds = submitted
    .filter((i) => i >= 0 && i < ids.length)
    .map((i) => ids[i])
    .filter((id): id is number => id !== undefined);

  const failedIds = errors
    .filter(([i]) => i >= 0 && i < ids.length)
    .map(([i]) => ids[i])
    .filter((id): id is number => id !== undefined);

  return { submittedIds, failedIds };
}

async function processQuarterGroup(params: {
  quarterId: string;
  quarterEntries: TimesheetEntry[];
  config: QuarterProcessingConfig;
}): Promise<{ ok: boolean; submittedIds: number[]; failedIds: number[] } | null> {
  const { quarterId, quarterEntries, config } = params;

  botLogger.info('Processing quarter', { quarterId, entryCount: quarterEntries.length });

  const quarterDef = quarterEntries[0] ? getQuarterForDate(quarterEntries[0].date) : null;
  if (!quarterDef) {
    botLogger.error('Could not determine quarter for entries', {
      firstDate: quarterEntries[0]?.date,
      dates: quarterEntries.map((e) => e.date),
    });
    return null;
  }

  const formConfig: FormConfig = config.useMockWebsite
    ? buildMockFormConfig()
    : createFormConfig(quarterDef.formUrl, quarterDef.formId);

  const ids = quarterEntries.map((e) => e.id).filter((id): id is number => id !== undefined);
  const botRows = quarterEntries.map((entry) => config.toBotRow(entry));
  botLogger.debug('Converted to bot format', { idMappings: ids });

  botLogger.verbose('Starting bot automation', { formUrl: formConfig.BASE_URL, formId: formConfig.FORM_ID });

  try {
    checkAborted(config.abortSignal, `Submission (quarter ${quarterId})`);
  } catch {
    botLogger.info('Submission aborted during quarter processing', { quarterId });
    throw new Error('Submission was cancelled');
  }

  const { ok, submitted, errors } = await config.runBot({
    rows: botRows,
    email: config.email,
    password: config.password,
    formConfig,
    ...(config.progressCallback && { progressCallback: config.progressCallback }),
    ...(config.abortSignal && { abortSignal: config.abortSignal }),
  });

  botLogger.info('Bot automation completed', { ok, submittedCount: submitted.length, errorCount: errors.length });

  if (errors.length > 0) {
    botLogger.error('Bot returned errors during submission', { errorCount: errors.length, errors });
  }

  botLogger.debug('Bot returned indices', { submitted, errors, idsArray: ids });

  const { submittedIds, failedIds } = mapBotResultsToIds(ids, submitted, errors);
  botLogger.info('Mapped bot results to IDs', {
    submittedIndices: submitted,
    submittedIds,
    failedIndices: errors.map(([i]) => i),
    failedIds,
    totalIds: ids.length,
  });

  return { ok, submittedIds, failedIds };
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
  // Helpful diagnostic: log each entry’s derived quarter so routing issues surface quickly.
  botLogger.debug('Checking entries for quarter assignment', {
    entries: entries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      quarter: getQuarterForDate(entry.date)?.id || 'NONE',
    })),
  });

  // Group entries by quarter (needed for form configuration)
  const quarterGroups = groupEntriesByQuarter(entries);
  botLogger.verbose('Entries grouped by quarter', { quarterCount: quarterGroups.size });

  const allSubmittedIds: number[] = [];
  const allFailedIds: number[] = [];
  let overallSuccess = true;

  // Process each quarter separately with appropriate form configuration
  for (const [quarterId, quarterEntries] of Array.from(quarterGroups.entries())) {
    const result = await processQuarterGroup({ quarterId, quarterEntries, config });
    if (!result) {
      quarterEntries.forEach((entry) => {
        if (entry.id) allFailedIds.push(entry.id);
      });
      overallSuccess = false;
      continue;
    }

    allSubmittedIds.push(...result.submittedIds);
    allFailedIds.push(...result.failedIds);
    if (!result.ok) overallSuccess = false;
  }

  return {
    ok: overallSuccess,
    submittedIds: allSubmittedIds,
    removedIds: allFailedIds,
    totalProcessed: entries.length,
    successCount: allSubmittedIds.length,
    removedCount: allFailedIds.length,
  };
}
