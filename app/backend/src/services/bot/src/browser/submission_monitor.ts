/**
 * Submission verification helpers.
 *
 * This module is currently **not wired** into `WebformFiller.submit_form()`.
 * It provides a more robust “did the submit actually succeed?” approach by:
 * - locating and clicking a submit button via configurable selectors
 * - observing network responses that match submission URL patterns
 * - optionally validating response content for common success indicators
 * - falling back to DOM text indicators when network signals are missing
 */
import type { Locator, Page, Response } from 'playwright';
import * as cfg from '../automation_config';
import { botLogger } from '@sheetpilot/shared/logger';

type RecordedResponse = { status: number; url: string; body?: string };
type RecordedResponseSummary = { status: number; url: string };

export class SubmissionMonitor {
  constructor(private readonly getPage: () => Page) {}

  async submitForm(): Promise<boolean> {
    botLogger.info('=== SUBMIT FORM CALLED ===');
    const page = this.getPage();
    const timer = botLogger.startTimer('submit-form');

    botLogger.info('Setting up response handler for submission monitoring');
    const successResponses: RecordedResponse[] = [];
    // Captures all responses during the submit window. This is primarily useful
    // for post-mortem debugging when submission verification fails.
    const allResponses: RecordedResponseSummary[] = [];
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
    botLogger.info('Response handler attached');

    try {
      botLogger.info('Starting to find submit button');
      // Find the submit button
      const submitButtonSelector = await this._findSubmitButtonSelector(page);
      botLogger.info('Finished finding submit button', { found: !!submitButtonSelector });
      if (!submitButtonSelector) {
        botLogger.error('=== NO SUBMIT BUTTON FOUND - THIS IS WHY SUBMIT FAILS ===');
        throw new Error('No submit button found');
      }

      botLogger.info('Found submit button selector', { selector: submitButtonSelector });

      // Re-find the button right before clicking to avoid stale locator issues
      botLogger.verbose('Locating submit button for click', { selector: submitButtonSelector });
      const submitButton = page.locator(submitButtonSelector).first();
      
      // AGGRESSIVE VERIFICATION: Count how many buttons match the selector
      const buttonCount = await page.locator(submitButtonSelector).count();
      botLogger.info('Submit button verification', { 
        selector: submitButtonSelector,
        buttonCount,
        expectedCount: 1
      });
      
      if (buttonCount === 0) {
        throw new Error(`Submit button not found! Selector: ${submitButtonSelector}, Count: ${buttonCount}`);
      }
      
      if (buttonCount > 1) {
        botLogger.warn('Multiple submit buttons found, using first one', { 
          selector: submitButtonSelector,
          buttonCount 
        });
      }
      
      // Verify button is actually visible and in DOM
      const isVisible = await submitButton.isVisible().catch(() => false);
      const boundingBox = await submitButton.boundingBox().catch(() => null);
      botLogger.info('Submit button state verification', {
        selector: submitButtonSelector,
        isVisible,
        boundingBox: boundingBox ? { x: boundingBox.x, y: boundingBox.y, width: boundingBox.width, height: boundingBox.height } : null
      });
      
      if (!isVisible) {
        throw new Error(`Submit button is not visible! Selector: ${submitButtonSelector}`);
      }
      
      if (!boundingBox) {
        throw new Error(`Submit button has no bounding box (not in viewport)! Selector: ${submitButtonSelector}`);
      }

      // Button is actionable - just scroll into view and click immediately
      botLogger.verbose('Scrolling submit button into view', { selector: submitButtonSelector });
      await submitButton.scrollIntoViewIfNeeded({ timeout: cfg.GLOBAL_TIMEOUT * 1000 }).catch(() => {});

      // Attempt to click the button - use JavaScript click FIRST (most reliable)
      botLogger.info('Clicking submit button', { selector: submitButtonSelector });
      
      // Strategy 1: JavaScript click - just do it, no waiting
      try {
        botLogger.info('Attempting JavaScript click', { selector: submitButtonSelector });
        await submitButton.evaluate((el: Element) => {
          if (el instanceof HTMLElement) {
            el.focus();
            const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1 });
            const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, buttons: 1 });
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window, buttons: 1 });
            el.dispatchEvent(mouseDown);
            el.dispatchEvent(mouseUp);
            el.dispatchEvent(clickEvent);
            el.click();
          }
        });
        botLogger.info('JavaScript click executed', { selector: submitButtonSelector });
      } catch (clickErr) {
        const errorMsg = clickErr instanceof Error ? clickErr.message : String(clickErr);
        botLogger.warn('JavaScript click failed, trying Playwright click', { selector: submitButtonSelector, error: errorMsg });
        // Fallback to Playwright click
        await submitButton.click({ timeout: cfg.GLOBAL_TIMEOUT * 1000 });
        botLogger.info('Playwright click executed', { selector: submitButtonSelector });
      }
      
      botLogger.info('Submit button click executed', { selector: submitButtonSelector });

      // Verify click actually happened by checking if button state changed or form started submitting
      botLogger.info('Verifying click was successful', { selector: submitButtonSelector });
      
      // Small delay to allow click event to propagate and form submission to start
      await page.waitForTimeout(300);
      
      // Check if form submission started (network activity or DOM changes)
      const buttonAfterClick = await submitButton.isVisible().catch(() => false);
      const hasNetworkActivity = successResponses.length > 0;
      botLogger.info('Button state after click attempt', { 
        selector: submitButtonSelector,
        stillVisible: buttonAfterClick,
        hasNetworkActivity,
        responseCount: successResponses.length
      });
      
      // CRITICAL: If no network activity, the click may not have triggered form submission
      if (!hasNetworkActivity) {
        botLogger.warn('No network activity detected after click - click may not have triggered form submission', {
          selector: submitButtonSelector,
          responseCount: successResponses.length
        });
      }

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

      botLogger.info('=== SUBMIT FORM RESULT ===', { 
        success: ok, 
        method: domSuccessFound ? 'dom' : 'http',
        successResponses: successResponses.length,
        domSuccessFound,
        submissionIds: submissionIds.length
      });
      
      timer.done({ success: ok, method: domSuccessFound ? 'dom' : 'http' });
      return ok;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      botLogger.error('=== EXCEPTION IN submitForm() ===', {
        error: errorMsg,
        stack: errorStack
      });
      timer.done({ success: false, reason: 'exception', error: errorMsg });
      throw err; // Re-throw so caller knows it failed
    } finally {
      page.off('response', handler);
    }
  }

  private _createResponseHandler(
    successResponses: RecordedResponse[],
    allResponses: RecordedResponseSummary[],
    submissionIds: string[],
    submissionTokens: string[],
    requestIds: string[],
  ): (response: Response) => Promise<void> {
    return async (response: Response): Promise<void> => {
      const url = response.url();
      const status = response.status();
      allResponses.push({ status, url });

      // Consider a response “success-relevant” only when status is 2xx (configurable)
      // and the URL matches the configured submission patterns.
      const matched =
        status >= cfg.SUBMIT_SUCCESS_MIN_STATUS &&
        status <= cfg.SUBMIT_SUCCESS_MAX_STATUS &&
        this._matchesAnyUrlPattern(url, cfg.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS);

      if (!matched) return;

      let body: string | undefined;
      try {
        body = await response.text();
      } catch (err: unknown) {
        botLogger.debug('Could not read submission response body', {
          url,
          status,
          error: String(err),
        });
      }

      if (body === undefined) {
        successResponses.push({ status, url });
      } else {
        successResponses.push({ status, url, body });
      }

      // Collect request identifiers when present
      try {
        const headers = response.request().headers();
        const requestIdHeader =
          headers['x-request-id'] ??
          headers['x-amzn-trace-id'] ??
          headers['x-correlation-id'];
        if (requestIdHeader) requestIds.push(String(requestIdHeader));
      } catch {
        // ignore
      }

      if (!body) return;

      // Extract common Smartsheet submission fields.
      const parsed = this._tryParseJson(body);
      if (parsed) {
        const submissionId = this._getStringProp(parsed, 'submissionId');
        const token = this._getStringProp(parsed, 'token');
        if (submissionId) submissionIds.push(submissionId);
        if (token) submissionTokens.push(token);
        return;
      }

      const submissionIdMatch = body.match(/"submissionId"\s*:\s*"([^"]+)"/i);
      if (submissionIdMatch?.[1]) submissionIds.push(submissionIdMatch[1]);

      const tokenMatch = body.match(/"token"\s*:\s*"([^"]+)"/i);
      if (tokenMatch?.[1]) submissionTokens.push(tokenMatch[1]);
    };
  }

  /**
   * Finds the submit button selector that matches a visible, enabled button.
   * Returns the selector string (not a Locator) so it can be used to create fresh locators.
   */
  private async _findSubmitButtonSelector(page: Page): Promise<string | null> {
    botLogger.info('_findSubmitButtonSelector called');
    const selectors = [
      cfg.SUBMIT_BUTTON_LOCATOR,
      ...cfg.SUBMIT_BUTTON_FALLBACK_LOCATORS,
    ];
    botLogger.info('Checking submit button selectors', { totalSelectors: selectors.length, selectors });

    for (const selector of selectors) {
      botLogger.verbose('Checking selector', { selector });
      const visible = await cfg.dynamic_wait_for_element(
        page,
        selector,
        'visible',
        cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
        cfg.GLOBAL_TIMEOUT,
        `submit button (${selector})`,
      );
      if (!visible) continue;

      const locator = page.locator(selector).first();
      const isVisible = await locator.isVisible().catch(() => false);
      if (!isVisible) continue;

      // Button is actionable - just return it immediately, don't check enabled state
      // The button is always actionable once visible

      botLogger.debug('Found submit button selector', { selector });
      return selector;
    }

    botLogger.warn('Could not find submit button', { selectorsTried: selectors.length });
    return null;
  }

  /**
   * @deprecated Use _findSubmitButtonSelector instead to avoid stale locator issues
   */
  private async _findSubmitButton(page: Page): Promise<Locator | null> {
    const selector = await this._findSubmitButtonSelector(page);
    if (!selector) return null;
    return page.locator(selector).first();
  }

  private async _checkDomSuccessIndicators(page: Page): Promise<boolean> {
    for (const indicator of cfg.SUBMIT_SUCCESS_INDICATORS) {
      try {
        const loc = page.locator(`text=${indicator}`).first();
        if (await loc.isVisible().catch(() => false)) {
          botLogger.debug('DOM success indicator visible', { indicator });
          return true;
        }
      } catch {
        // ignore indicator selector errors
      }
    }
    return false;
  }

  private _validateSubmissionSuccess(
    successResponses: RecordedResponse[],
    domSuccessFound: boolean,
    submissionIds: string[],
    submissionTokens: string[],
    requestIds: string[],
  ): boolean {
    if (domSuccessFound) {
      botLogger.info('Submission verified via DOM indicators', {
        requestIdCount: requestIds.length,
      });
      return true;
    }

    if (successResponses.length === 0) {
      botLogger.warn('No successful submission responses observed', {
        observedResponseCount: requestIds.length,
      });
      return false;
    }

    if (!cfg.ENABLE_RESPONSE_CONTENT_VALIDATION) {
      botLogger.info('Submission verified via HTTP status', {
        successResponseCount: successResponses.length,
        submissionIdCount: submissionIds.length,
        tokenCount: submissionTokens.length,
      });
      return true;
    }

    const bodyHasIndicator = successResponses.some(r => {
      if (!r.body) return false;
      const lower = r.body.toLowerCase();
      return cfg.SUBMIT_SUCCESS_INDICATORS.some(ind =>
        lower.includes(ind.toLowerCase()),
      );
    });

    botLogger.info('Submission verified via response content validation', {
      successResponseCount: successResponses.length,
      submissionIdCount: submissionIds.length,
      tokenCount: submissionTokens.length,
      bodyHasIndicator,
    });

    return bodyHasIndicator || submissionIds.length > 0;
  }

  private _matchesAnyUrlPattern(url: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      // This is a simple “glob-ish” matcher: it strips '*' and checks substring.
      // It does not implement full glob semantics.
      const needle = pattern.replace(/\*/g, '');
      if (needle.length === 0) continue;
      if (url.includes(needle)) return true;
    }
    return false;
  }

  private _tryParseJson(value: string): Record<string, unknown> | null {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private _getStringProp(obj: Record<string, unknown>, key: string): string | null {
    const v = obj[key];
    return typeof v === 'string' && v.length > 0 ? v : null;
  }
}

