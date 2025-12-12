import * as path from 'path';
import type { App } from 'electron';

export function ensureDevUserDataPath(app: App): void {
  // Ensure development runs use the same userData folder as packaged builds.
  // When you launch Electron via `electron path/to/main.js`, Electron can default to an "Electron" app name,
  // which changes `app.getPath('userData')` and makes file logs appear "missing".
  // `npm run dev` sets ELECTRON_IS_DEV=1.
  if (process.env['ELECTRON_IS_DEV'] === '1' && app.isPackaged === false) {
    const devUserDataPath = path.join(app.getPath('appData'), 'sheetpilot');
    app.setPath('userData', devUserDataPath);
  }
}


