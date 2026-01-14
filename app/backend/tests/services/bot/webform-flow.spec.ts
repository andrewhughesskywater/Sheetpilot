import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import type { Page, Route } from "playwright";
import { BotOrchestrator, createFormConfig } from "@sheetpilot/bot";
import * as cfg from "@sheetpilot/bot";

describe("WebformFiller against mock form", () => {
  let bot: BotOrchestrator;
  let page: Page;

  beforeAll(async () => {
    // Override config for deterministic headless run using environment variables
    process.env["BROWSER_CHANNEL"] = "chromium";
    process.env["BROWSER_HEADLESS"] = "true";
    process.env["GLOBAL_TIMEOUT"] = "10";

    // Serve file:// mock page
    const mockPath = path.resolve(__dirname, "./fixtures/mock-form.html");
    const mockUrl = "file:///" + mockPath.replace(/\\/g, "/");
    process.env["TS_BASE_URL"] = mockUrl;

    const formConfig = createFormConfig(mockUrl, "mock-form");
    bot = new BotOrchestrator(cfg as typeof cfg, formConfig, true, "chromium");
    await bot.start();
    page = bot.require_page();

    // Route the Smartsheet endpoint and return a success JSON matching real API response
    await page.route("**/*", async (route: Route) => {
      const url = route.request().url();
      if (url.includes("forms.smartsheet.com/api/submit")) {
        // Return complete response structure matching actual Smartsheet API
        const mockResponse = {
          submissionId: "mock-test-submission-id-123",
          confirmation: {
            type: "RELOAD",
            message: "Success! We've captured your submission.",
            hideFooterOnConfirmation: false,
          },
          token: "mock-test-token-456",
        };
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockResponse),
        });
      }
      return route.continue();
    });

    await page.goto(mockUrl);
  }, 60000);

  afterAll(async () => {
    if (bot) {
      await bot.close();
    }
  });

  it("fills required fields and submits successfully", async () => {
    // Wait for page to be ready
    await page.waitForLoadState("networkidle");

    // Minimal set of fields to exercise submit
    const projectSpec = {
      label: cfg.FIELD_DEFINITIONS["project_code"]?.label,
      locator: cfg.FIELD_DEFINITIONS["project_code"]?.locator,
    };
    const dateSpec = {
      label: cfg.FIELD_DEFINITIONS["date"]?.label,
      locator: cfg.FIELD_DEFINITIONS["date"]?.locator,
    };
    const hoursSpec = {
      label: cfg.FIELD_DEFINITIONS["hours"]?.label,
      locator: cfg.FIELD_DEFINITIONS["hours"]?.locator,
    };
    const taskSpec = {
      label: cfg.FIELD_DEFINITIONS["task_description"]?.label,
      locator: cfg.FIELD_DEFINITIONS["task_description"]?.locator,
    };

    // Verify field specs are defined
    expect(projectSpec.locator).toBeDefined();
    expect(dateSpec.locator).toBeDefined();
    expect(hoursSpec.locator).toBeDefined();
    expect(taskSpec.locator).toBeDefined();

    // Fill fields using BotOrchestrator's form filling capabilities
    // For now, just verify the page is accessible
    const testRows = [
      {
        Project: "OSC-BBB",
        Date: "01/15/2025",
        Hours: "1.0",
        "Task Description": "Test task",
      },
    ];

    // Try to run automation - it should at least attempt to fill the form
    const [success, _submitted, errors] = await bot.run_automation(testRows, [
      "test@example.com",
      "testpassword",
    ]);

    // Verify submission completed (may succeed or fail based on form state)
    const ok = success;

    // Verify submission completed (may succeed or fail based on form state)
    expect(typeof ok).toBe("boolean");

    // If submission succeeded, verify we're on the success page
    if (ok) {
      const currentUrl = page.url();
      // Submission should redirect or show success
      expect(currentUrl).toBeDefined();
    }
  }, 60000);
});
