import type { App } from 'electron';

export function configureElectronCommandLine(app: App): void {
  // Configure Electron - minimal switches for stability
  // These must be set before app.whenReady()
  // Disable background throttling for automation browser windows
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
}
