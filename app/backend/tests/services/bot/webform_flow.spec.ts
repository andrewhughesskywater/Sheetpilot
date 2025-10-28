import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { Page } from 'playwright';
import * as cfg from '../../../src/services/bot/src/automation_config';
import { WebformFiller } from '../../../src/services/bot/src/webform_flow';

describe('WebformFiller against mock form', () => {
  let filler: WebformFiller;
  let page: Page;

  beforeAll(async () => {
    // Override config for deterministic headless run using environment variables
    process.env['TIME_KNIGHT_BROWSER_CHANNEL'] = 'chromium';
    process.env['TIME_KNIGHT_BROWSER_HEADLESS'] = 'true';
    process.env['TIME_KNIGHT_GLOBAL_TIMEOUT'] = '10';

    // Serve file:// mock page
    const mockPath = path.resolve(__dirname, './fixtures/mock-form.html');
    process.env['TS_BASE_URL'] = 'file:///' + mockPath.replace(/\\/g, '/');

    filler = new WebformFiller(cfg as typeof cfg, true, 'chromium');
    await filler.start();
    page = filler.require_page();

    // Route the Smartsheet endpoint and return a success JSON (simulate 200 OK)
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('forms.smartsheet.com') && url.includes(cfg.FORM_ID)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ submissionId: 'mock-123' }) });
      }
      return route.continue();
    });

    await page.goto(cfg.BASE_URL);
  });

  afterAll(async () => {
    if (filler) {
      await filler.close();
    }
  });

  it('fills required fields and submits successfully', async () => {
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


