import { describe, it, expect } from 'vitest';
import * as C from '../../../src/services/bot/src/config/automation_config';
import { LoginManager, type BrowserManager } from '../../../src/services/bot/src/utils/authentication_flow';
import type { Page } from 'playwright';

class FakeFiller implements BrowserManager {
  private _url: string;
  private _page: Page;
  formConfig = {
    BASE_URL: 'https://example.com',
    FORM_ID: 'test-form',
    SUBMISSION_ENDPOINT: 'https://example.com/submit',
    SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: []
  };
  
  constructor(u: string) { 
    this._url = u;
    this._page = { url: () => this._url } as Page;
  }
  
  require_page(): Page {
    return this._page;
  }
  
  getPage(_index: number): Page {
    return this._page;
  }
}

describe('LoginManager.validate_login_state', () => {
  it('returns true when current URL includes any success pattern', async () => {
    (C as Record<string, unknown>)['LOGIN_SUCCESS_URLS'] = ['app.smartsheet.com/b/home', 'forms.smartsheet.com'];
    const mgr = new LoginManager(C as typeof C, new FakeFiller('https://app.smartsheet.com/b/home'));
    await expect(mgr.validate_login_state()).resolves.toBe(true);
  });

  it('returns true (default) even if patterns not matched (back-compat)', async () => {
    (C as Record<string, unknown>)['LOGIN_SUCCESS_URLS'] = ['some-other-url'];
    const mgr = new LoginManager(C as typeof C, new FakeFiller('https://example.com/'));
    await expect(mgr.validate_login_state()).resolves.toBe(true);
  });

  it('returns false when require_page throws', async () => {
    const bad: BrowserManager = {
      require_page() { throw new Error('no page'); },
      getPage() { throw new Error('no page'); },
      formConfig: {
        BASE_URL: 'https://example.com',
        FORM_ID: 'test-form',
        SUBMISSION_ENDPOINT: 'https://example.com/submit',
        SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: []
      }
    };
    const mgr = new LoginManager(C as typeof C, bad);
    await expect(mgr.validate_login_state()).resolves.toBe(false);
  });
});


