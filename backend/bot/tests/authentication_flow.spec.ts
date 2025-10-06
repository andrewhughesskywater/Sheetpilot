import { describe, it, expect } from 'vitest';
import * as C from '../src/automation_config';
import { LoginManager } from '../src/authentication_flow';

class FakeFiller {
  private _url: string;
  constructor(u: string) { this._url = u; }
  require_page() { return { url: () => this._url } as any; }
}

describe('LoginManager.validate_login_state', () => {
  it('returns true when current URL includes any success pattern', async () => {
    (C as any).LOGIN_SUCCESS_URLS = ['app.smartsheet.com/b/home', 'forms.smartsheet.com'];
    const mgr = new LoginManager(C as any, new FakeFiller('https://app.smartsheet.com/b/home') as any);
    await expect(mgr.validate_login_state()).resolves.toBe(true);
  });

  it('returns true (default) even if patterns not matched (back-compat)', async () => {
    (C as any).LOGIN_SUCCESS_URLS = ['some-other-url'];
    const mgr = new LoginManager(C as any, new FakeFiller('https://example.com/') as any);
    await expect(mgr.validate_login_state()).resolves.toBe(true);
  });

  it('returns false when require_page throws', async () => {
    const bad = { require_page() { throw new Error('no page'); } } as any;
    const mgr = new LoginManager(C as any, bad);
    await expect(mgr.validate_login_state()).resolves.toBe(false);
  });
});


