import type { BrowserWindow, IpcMainInvokeEvent, WebContents } from 'electron';

let mainWindowRef: BrowserWindow | null = null;
let mainWebContentsId: number | null = null;

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindowRef = window;
  mainWebContentsId = window?.webContents.id ?? null;
}

export function isTrustedIpcSender(event: IpcMainInvokeEvent): boolean {
  if (mainWebContentsId === null) {
    return false;
  }
  const sender: WebContents | undefined = event.sender;
  return sender.id === mainWebContentsId;
}

export function emitSubmissionProgress(progressData: {
  percent: number;
  current: number;
  total: number;
  message: string;
}): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('timesheet:progress', progressData);
  }
}
