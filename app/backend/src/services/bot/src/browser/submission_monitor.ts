// submission_monitor.ts
import type { Page, Response } from 'playwright';
import * as cfg from './automation_config';
import { botLogger } from '@sheetpilot/shared/logger';

export class SubmissionMonitor {
  constructor(private readonly getPage: () => Page) {}

  async submitForm(): Promise<boolean> {
    const page = this.getPage();
    const timer = botLogger.startTimer('submit-form');

    const successResponses: Array<{ status: number; url: string; body?: string }> = [];
    const allResponses: Array<{ status: number; url: string }> = [];
    const submissionIds: string[] = [];
    const submissionTokens: string[] = [];
    const requestIds: string[] = [];

    const handler = this._createResponseHandler(
      successResponses,
      allResponses,
      submissionIds,
      submissionTokens,
      requestIds,
    );
    page.on('response', handler);

    try {
      const submitButton = await this._findSubmitButton(page);
      if (!submitButton) {
        throw new Error('No submit button found');
      }

      await submitButton.click();

      let domSuccessFound = false;

      try {
        const verifyTimeout = Math.min(
          cfg.SUBMIT_VERIFY_TIMEOUT_MS / 1000.0,
          cfg.GLOBAL_TIMEOUT,
        );

        await cfg.dynamic_wait(
          async () => {
            if (successResponses.length > 0) return true;
            domSuccessFound = await this._checkDomSuccessIndicators(page);
            return domSuccessFound;
          },
          cfg.DYNAMIC_WAIT_BASE_TIMEOUT * cfg.HALF_TIMEOUT_MULTIPLIER,
          verifyTimeout,
          cfg.DYNAMIC_WAIT_MULTIPLIER,
          'form submission verification',
        );
      } catch (e) {
        botLogger.warn('Submission verification timed out', { error: String(e) });
      }

      const ok = this._validateSubmissionSuccess(
        successResponses,
        domSuccessFound,
        submissionIds,
        submissionTokens,
        requestIds,
      );

      timer.done({ success: ok, method: domSuccessFound ? 'dom' : 'http' });
      return ok;
    } finally {
      page.off('response', handler);
    }
  }

  private _createResponseHandler(/* same params */) {
    return async (response: Response) => {
      // your existing Smartsheet-specific response logic
    };
  }

  private async _findSubmitButton(page: Page) {
    // your existing fallback locator loop
  }

  private async _checkDomSuccessIndicators(page: Page): Promise<boolean> {
    // your existing DOM check
  }

  private _validateSubmissionSuccess(/* ... */): boolean {
    // your existing aggregation logic
  }
}
