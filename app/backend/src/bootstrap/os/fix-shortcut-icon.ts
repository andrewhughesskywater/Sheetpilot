import type { App } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import type { LoggerLike } from '../logging/logger-contract';

export function fixDesktopShortcutIcon(params: { app: App; logger: LoggerLike; packagedLike: boolean }): void {
  if (process.platform !== 'win32' || !params.packagedLike) {
    return; // Only run on Windows in packaged mode
  }

  // In packaged mode, use process.resourcesPath
  const scriptPath = path.join(process.resourcesPath, 'app.asar', 'scripts', 'fix-shortcut-icon.ps1');

  // Extract script from ASAR to temp location since PowerShell can't read from ASAR
  const tempDir = params.app.getPath('temp');
  const tempScriptPath = path.join(tempDir, 'sheetpilot-fix-shortcut.ps1');

  try {
    // Read from ASAR and write to temp
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    fs.writeFileSync(tempScriptPath, scriptContent, 'utf8');
  } catch (err: unknown) {
    params.logger.debug('Could not extract shortcut fix script', {
      error: err instanceof Error ? err.message : String(err),
      scriptPath,
    });
    return;
  }

  // Run PowerShell script in background
  const { spawn } = require('child_process') as typeof import('child_process');
  const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tempScriptPath], {
    detached: true,
    stdio: 'ignore',
  });

  ps.unref(); // Don't wait for completion
  params.logger.debug('Started desktop shortcut icon fix', { tempScriptPath });
}
