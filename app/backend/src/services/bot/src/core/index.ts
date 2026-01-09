/**
 * Public API for the Sheetpilot timesheet automation bot.
 *
 * ## How to navigate this package
 * - **Orchestration**: `BotOrchestrator` coordinates the full workflow (login → fill → submit).
 * - **Browser automation**: `WebformFiller` owns Playwright lifecycle and page interactions.
 * - **Authentication**: `LoginManager` executes `LOGIN_STEPS` (config-driven login recipe).
 * - **Configuration**: `automation_config.ts` provides selectors, timeouts, and behavior flags.
 * - **Quarter routing**: `quarter_config.ts` maps dates to the correct Smartsheet form.
 *
 * ## Common call path (simplified)
 *
 * ```mermaid
 * flowchart TD
 *   caller[Caller] --> runTimesheet
 *   runTimesheet --> orchestrator[BotOrchestrator]
 *   orchestrator --> startBrowser[WebformFiller.start]
 *   orchestrator --> login[LoginManager.runLoginSteps]
 *   orchestrator --> processRows[ProcessRows]
 *   processRows --> fill[FillFields]
 *   processRows --> submit[SubmitAndVerify]
 *   submit --> monitor[SubmissionMonitor_or_submit_form]
 *   processRows --> cleanup[CloseBrowser]
 * ```
 *
 * ## Compatibility note
 * Some files in `src/` exist only to preserve historic import paths (re-exports).
 * Prefer importing from this module (`src/core/index.ts`) for new code.
 */

// Core automation classes
import { appSettings } from '@sheetpilot/shared/constants';

import { botLogger } from '../../utils/logger';
import * as Cfg from '../config/automation_config';
import { BotOrchestrator } from './bot_orchestation';

export { type AutomationResult,BotOrchestrator, TimesheetBot } from './bot_orchestation';

// Authentication and login management
export { BotNavigationError,LoginManager } from '../utils/authentication_flow';

// Browser automation and form interaction
export { BotNotStartedError,WebformFiller } from '../browser/webform_flow';

// Configuration constants and utilities
export * from '../config/automation_config';

// Quarter configuration and routing
export * from '../config/quarter_config';

interface RunTimesheetConfig {
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
}

type RunTimesheetResult = {
  ok: boolean;
  submitted: number[];
  errors: Array<[number, string]>;
};

function cancelledRunResult(message: string): RunTimesheetResult {
  return { ok: false, submitted: [], errors: [[0, message]] };
}

function emptyRunResult(): RunTimesheetResult {
  return { ok: true, submitted: [], errors: [] };
}

function isAborted(signal: RunTimesheetConfig['abortSignal']): boolean {
  if (!signal) return false;
  const maybe = signal as { aborted?: unknown };
  return maybe.aborted === true;
}

function resolveAbortSignal(signal: RunTimesheetConfig['abortSignal']): AbortSignal | undefined {
  if (!signal) return undefined;

  const maybeAbortSignal = signal as {
    aborted?: unknown;
    addEventListener?: unknown;
    removeEventListener?: unknown;
  };
  const looksLikeAbortSignal =
    typeof maybeAbortSignal.aborted === 'boolean' &&
    typeof maybeAbortSignal.addEventListener === 'function' &&
    typeof maybeAbortSignal.removeEventListener === 'function';
  if (looksLikeAbortSignal) return signal as AbortSignal;

  if (isAborted(signal)) {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  }
  return undefined;
}

function isCancellationLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('cancelled') ||
    msg.includes('canceled') ||
    msg.includes('aborted') ||
    msg.includes('browser has been closed') ||
    msg.includes('target closed')
  );
}

async function safeCloseBot(bot: BotOrchestrator): Promise<void> {
  try {
    botLogger.verbose('Closing browser');
    await bot.close();
    botLogger.info('Browser closed successfully');
  } catch (closeError) {
    botLogger.error('Could not close bot browser', {
      error: closeError instanceof Error ? closeError.message : String(closeError),
    });
  }
}

/**
 * Runs timesheet automation for a batch of rows.
 *
 * Callers typically create `rows` from timesheet entries. The bot returns
 * **row indices** (0-based, relative to the `rows` array passed in).
 *
 * `formConfig` must match the form you expect to submit to (usually quarter-based).
 */
export async function runTimesheet(config: RunTimesheetConfig): Promise<{
  ok: boolean;
  submitted: number[];
  errors: Array<[number, string]>;
}> {
  const { rows, email, password, formConfig, progressCallback, headless, abortSignal } = config;
  // Prefer the explicit parameter, otherwise use the UI-controlled setting.
  // `appSettings.browserHeadless` updates at runtime when a user changes Settings.
  const useHeadless = headless !== undefined ? headless : appSettings.browserHeadless;
  botLogger.info('Initializing bot orchestrator', {
    headlessParam: headless,
    useHeadless,
    appSettingsBrowserHeadless: appSettings.browserHeadless,
    hasProgressCallback: Boolean(progressCallback),
  });
  const bot = new BotOrchestrator({
    injected_config: Cfg,
    formConfig,
    headless: useHeadless,
    browser: null,
    ...(progressCallback && { progress_callback: progressCallback }),
  });

  try {
    if (isAborted(abortSignal)) {
      botLogger.info('Automation aborted before starting');
      return cancelledRunResult('Automation was cancelled');
    }

    if (rows.length === 0) {
      botLogger.info('No rows to process, returning success immediately');
      return emptyRunResult();
    }

    // Initialize the browser before running automation
    botLogger.info('Starting browser initialization', { rowCount: rows.length });
    await bot.start();
    botLogger.info('Browser started successfully');

    if (isAborted(abortSignal)) {
      botLogger.info('Automation aborted after browser start');
      return cancelledRunResult('Automation was cancelled');
    }

    botLogger.info('Starting automation', { rowCount: rows.length });
    const actualAbortSignal = resolveAbortSignal(abortSignal);
    const [success, submitted_indices, errors] = await bot.runAutomation(rows, [email, password], actualAbortSignal);
    botLogger.info('Automation completed', {
      success,
      submittedCount: submitted_indices.length,
      errorCount: errors.length,
    });

    return { ok: success, submitted: submitted_indices, errors };
  } catch (error) {
    if (isCancellationLikeError(error)) {
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      if (msg.includes('browser has been closed') || msg.includes('target closed')) {
        botLogger.info('Browser was closed during automation');
        return cancelledRunResult('Automation was cancelled - browser closed');
      }

      botLogger.info('Automation was cancelled');
      return cancelledRunResult('Automation was cancelled');
    }

    botLogger.error('Error during automation', { error: error instanceof Error ? error.message : String(error) });
    // Re-throw the error so it can be properly handled by the calling code
    throw error;
  } finally {
    await safeCloseBot(bot);
  }
}
