import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import type { Page, Route } from 'playwright';
import * as cfg from '../../../src/services/bot/src/config/automation_config';
import { WebformFiller } from '../../../src/services/bot/src/browser/webform_flow';

describe('WebformFiller against mock form', () => {
  let filler: WebformFiller;
  let page: Page;

  beforeAll(async () => {
    // Override config for deterministic headless run using environment variables
    process.env['BROWSER_CHANNEL'] = 'chromium';
    process.env['BROWSER_HEADLESS'] = 'true';
    process.env['GLOBAL_TIMEOUT'] = '10';

    // Serve file:// mock page
    const mockPath = path.resolve(__dirname, './fixtures/mock-form.html');
    const mockUrl = 'file:///' + mockPath.replace(/\\/g, '/');
    process.env['TS_BASE_URL'] = mockUrl;

    filler = new WebformFiller(cfg as typeof cfg, true, 'chromium');
    await filler.start();
    page = filler.require_page();

    // Route the Smartsheet endpoint and return a success JSON matching real API response
    await page.route('**/*', async (route: Route) => {
      const url = route.request().url();
      if (url.includes('forms.smartsheet.com/api/submit')) {
        // Return complete response structure matching actual Smartsheet API
        const mockResponse = {
          submissionId: 'mock-test-submission-id-123',
          confirmation: {
            type: 'RELOAD',
            message: "Success! We've captured your submission.",
            hideFooterOnConfirmation: false
          },
          token: 'mock-test-token-456'
        };
        return route.fulfill({ 
          status: 200, 
          contentType: 'application/json', 
          body: JSON.stringify(mockResponse) 
        });
      }
      return route.continue();
    });

    await page.goto(mockUrl);
  }, 60000);

  afterAll(async () => {
    if (filler) {
      await filler.close();
    }
  });

  it.skip('fills required fields and submits successfully', async () => {
    await filler.wait_for_form_ready();

    // Minimal set of fields to exercise submit
    await filler.inject_field_value({ label: 'Project', locator: "input[aria-label='Project']" }, 'OSC-BBB');
    await filler.inject_field_value({ label: 'Date', locator: "input[placeholder='mm/dd/yyyy']" }, '01/15/2025');
    await filler.inject_field_value({ label: 'Hours', locator: "input[aria-label='Hours']" }, '1.0');
    await filler.inject_field_value({ label: 'Task Description', locator: "role=textbox[name='Task Description']" }, 'Test task');

    const ok = await filler.submit_form();
    expect(ok).toBe(true);
  });
});


