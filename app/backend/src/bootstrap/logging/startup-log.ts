import * as fs from 'fs';
import * as path from 'path';
import type { App } from 'electron';

export function writeStartupLog(app: App, backendDirname: string): void {
  try {
    const startupLogPath = path.join(
      process.env['TEMP'] || process.env['TMP'] || process.cwd(),
      'sheetpilot-startup.log'
    );
    const startupLog = fs.createWriteStream(startupLogPath, { flags: 'a' });
    startupLog.write(`[${new Date().toISOString()}] Application starting...\n`);
    startupLog.write(`__dirname: ${backendDirname}\n`);
    startupLog.write(`process.resourcesPath: ${process.resourcesPath}\n`);
    startupLog.write(`app.isPackaged: ${app.isPackaged}\n`);
    startupLog.write(`app.name: ${app.getName()}\n`);
    startupLog.write(`app.userDataPath: ${app.getPath('userData')}\n`);
    startupLog.write(`process.execPath: ${process.execPath}\n`);
    startupLog.end();
  } catch {
    // Ignore startup log errors - this is just for debugging
  }
}


