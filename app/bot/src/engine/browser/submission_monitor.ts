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
import type { Locator, Page, Response } from "playwright";
import * as cfg from "../config/automation_config";
import { botLogger } from "@sheetpilot/shared/logger";

type RecordedResponse = { status: number; url: string; body?: string };
type RecordedResponseSummary = { status: number; url: string };

export class SubmissionMonitor {
  private readonly getPage: () => Page;

  constructor(getPage: () => Page) {
    this.getPage = getPage;
  }

  async submitForm(): Promise<boolean> {
    const page = this.getPage();
    const timer = botLogger.startTimer("submit-form");

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
      requestIds
    );
    page.on("response", handler);

    try {
      const submitButton = await this._findSubmitButton(page);
      if (!submitButton) {
        throw new Error("No submit button found");
      }

      await submitButton.click();

      let domSuccessFound = false;

      try {
        const verifyTimeout = Math.min(
          cfg.SUBMIT_VERIFY_TIMEOUT_MS / 1000.0,
          cfg.GLOBAL_TIMEOUT
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
          "form submission verification"
        );
      } catch (e) {
        botLogger.warn("Submission verification timed out", {
          error: String(e),
        });
      }

      const ok = this._validateSubmissionSuccess(
        successResponses,
        domSuccessFound,
        submissionIds,
        submissionTokens,
        requestIds
      );

      timer.done({ success: ok, method: domSuccessFound ? "dom" : "http" });
      return ok;
    } finally {
      page.off("response", handler);
    }
  }

  private _createResponseHandler(
    successResponses: RecordedResponse[],
    allResponses: RecordedResponseSummary[],
    submissionIds: string[],
    submissionTokens: string[],
    requestIds: string[]
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
        this._matchesAnyUrlPattern(
          url,
          cfg.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS
        );

      if (!matched) return;

      let body: string | undefined;
      try {
        body = await response.text();
      } catch (err: unknown) {
        botLogger.debug("Could not read submission response body", {
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
          headers["x-request-id"] ??
          headers["x-amzn-trace-id"] ??
          headers["x-correlation-id"];
        if (requestIdHeader) requestIds.push(String(requestIdHeader));
      } catch {
        // ignore
      }

      if (!body) return;

      // Extract common Smartsheet submission fields.
      const parsed = this._tryParseJson(body);
      if (parsed) {
        const submissionId = this._getStringProp(parsed, "submissionId");
        const token = this._getStringProp(parsed, "token");
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

  private async _findSubmitButton(page: Page): Promise<Locator | null> {
    const selectors = [
      cfg.SUBMIT_BUTTON_LOCATOR,
      ...cfg.SUBMIT_BUTTON_FALLBACK_LOCATORS,
    ];

    for (const selector of selectors) {
      const visible = await cfg.dynamic_wait_for_element(
        page,
        selector,
        "visible",
        cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
        cfg.GLOBAL_TIMEOUT,
        `submit button (${selector})`
      );
      if (!visible) continue;

      const locator = page.locator(selector).first();
      const isVisible = await locator.isVisible().catch(() => false);
      if (!isVisible) continue;

      if (cfg.SUBMIT_BUTTON_REQUIRE_ENABLED) {
        const isEnabled = await locator.isEnabled().catch(() => false);
        if (!isEnabled) continue;
      }

      if (cfg.ENABLE_ARIA_DISABLED_CHECK) {
        const ariaDisabled = await locator
          .getAttribute("aria-disabled")
          .catch(() => null);
        if (ariaDisabled && ariaDisabled !== "false") continue;
      }

      botLogger.debug("Found submit button", { selector });
      return locator;
    }

    botLogger.warn("Could not find submit button", {
      selectorsTried: selectors.length,
    });
    return null;
  }

  private async _checkDomSuccessIndicators(page: Page): Promise<boolean> {
    for (const indicator of cfg.SUBMIT_SUCCESS_INDICATORS) {
      try {
        const loc = page.locator(`text=${indicator}`).first();
        if (await loc.isVisible().catch(() => false)) {
          botLogger.debug("DOM success indicator visible", { indicator });
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
    requestIds: string[]
  ): boolean {
    if (domSuccessFound) {
      botLogger.info("Submission verified via DOM indicators", {
        requestIdCount: requestIds.length,
      });
      return true;
    }

    if (successResponses.length === 0) {
      botLogger.warn("No successful submission responses observed", {
        observedResponseCount: requestIds.length,
      });
      return false;
    }

    if (!cfg.ENABLE_RESPONSE_CONTENT_VALIDATION) {
      botLogger.info("Submission verified via HTTP status", {
        successResponseCount: successResponses.length,
        submissionIdCount: submissionIds.length,
        tokenCount: submissionTokens.length,
      });
      return true;
    }

    const bodyHasIndicator = successResponses.some((r) => {
      if (!r.body) return false;
      const lower = r.body.toLowerCase();
      return cfg.SUBMIT_SUCCESS_INDICATORS.some((ind) =>
        lower.includes(ind.toLowerCase())
      );
    });

    botLogger.info("Submission verified via response content validation", {
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
      const needle = pattern.replace(/\*/g, "");
      if (needle.length === 0) continue;
      if (url.includes(needle)) return true;
    }
    return false;
  }

  private _tryParseJson(value: string): Record<string, unknown> | null {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private _getStringProp(
    obj: Record<string, unknown>,
    key: string
  ): string | null {
    const v = obj[key];
    return typeof v === "string" && v.length > 0 ? v : null;
  }
}
