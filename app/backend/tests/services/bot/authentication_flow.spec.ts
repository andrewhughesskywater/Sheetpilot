import { describe, it, expect } from 'vitest';
import * as C from '../../../src/services/bot/src/automation_config';
import { LoginManager } from '../../../src/services/bot/src/authentication_flow';

class FakeFiller {
  private _url: string;
  constructor(u: string) { this._url = u; }
  require_page() { return { url: () => this._url } as { url: () => string }; }
}

describe('LoginManager.validate_login_state', () => {
  it('returns true when current URL includes any success pattern', async () => {
    (C as Record<string, unknown>)['LOGIN_SUCCESS_URLS'] = ['app.smartsheet.com/b/home', 'forms.smartsheet.com'];
    const mgr = new LoginManager(C as typeof C, new FakeFiller('https://app.smartsheet.com/b/home') as unknown as import('../../../src/services/bot/src/browser/webform_flow').WebformFiller);
    await expect(mgr.validate_login_state()).resolves.toBe(true);
  });

  it('returns true (default) even if patterns not matched (back-compat)', async () => {
    (C as Record<string, unknown>)['LOGIN_SUCCESS_URLS'] = ['some-other-url'];
    const mgr = new LoginManager(C as typeof C, new FakeFiller('https://example.com/') as unknown as import('../../../src/services/bot/src/browser/webform_flow').WebformFiller);
    await expect(mgr.validate_login_state()).resolves.toBe(true);
  });

  it('returns false when require_page throws', async () => {
    const bad = { require_page() { throw new Error('no page'); } } as { require_page: () => never };
    const mgr = new LoginManager(C as typeof C, bad as unknown as import('../../../src/services/bot/src/browser/webform_flow').WebformFiller);
    await expect(mgr.validate_login_state()).resolves.toBe(false);
  });
});


