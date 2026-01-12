import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import type { Page, Route } from 'playwright';
import * as cfg from '../../../src/services/bot/src/automation_config';
import { WebformFiller } from '../../../src/services/bot/src/webform_flow';

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
    const projectSpec = { label: cfg.FIELD_DEFINITIONS['project_code']?.label, locator: cfg.FIELD_DEFINITIONS['project_code']?.locator };
    const dateSpec = { label: cfg.FIELD_DEFINITIONS['date']?.label, locator: cfg.FIELD_DEFINITIONS['date']?.locator };
    const hoursSpec = { label: cfg.FIELD_DEFINITIONS['hours']?.label, locator: cfg.FIELD_DEFINITIONS['hours']?.locator };
    const taskSpec = { label: cfg.FIELD_DEFINITIONS['task_description']?.label, locator: cfg.FIELD_DEFINITIONS['task_description']?.locator };
    
    await filler.inject_field_value(projectSpec, 'OSC-BBB');
    await filler.inject_field_value(dateSpec, '01/15/2025');
    await filler.inject_field_value(hoursSpec, '1.0');
    await filler.inject_field_value(taskSpec, 'Test task');

    const ok = await filler.submit_form();
    expect(ok).toBe(true);
  });
});


