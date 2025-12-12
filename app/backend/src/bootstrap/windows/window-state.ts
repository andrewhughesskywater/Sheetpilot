import * as fs from 'fs';
import * as path from 'path';
import type { App, BrowserWindow, Screen } from 'electron';
import type { LoggerLike } from '../logging/logger-contract';

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

export function getDefaultWindowState(): WindowState {
  const defaultWidth = 1200;
  const defaultHeight = Math.round(defaultWidth * 1.618);

  // Fast path: return defaults immediately for quick startup
  // Window state will be restored asynchronously after window is shown
  return {
    width: defaultWidth,
    height: defaultHeight,
    isMaximized: false
  };
}

export async function restoreWindowState(params: {
  app: App;
  screen: Screen;
  window: BrowserWindow;
  logger: LoggerLike;
}): Promise<void> {
  try {
    const userDataPath = params.app.getPath('userData');
    const windowStatePath = path.join(userDataPath, 'window-state.json');

    const data = await fs.promises.readFile(windowStatePath, 'utf8');
    const savedState = JSON.parse(data) as Partial<WindowState>;

    const { width, height, x, y, isMaximized } = savedState;
    const display = params.screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;

    // Ensure window is not larger than screen
    const validWidth = Math.min(width || 1200, screenWidth);
    const validHeight = Math.min(height || 1943, screenHeight);

    // Ensure window position is within screen bounds
    let validX = x;
    let validY = y;

    if (validX !== undefined && validY !== undefined) {
      validX = Math.max(0, Math.min(validX, screenWidth - validWidth));
      validY = Math.max(0, Math.min(validY, screenHeight - validHeight));
    }

    // Restore window state
    if (isMaximized) {
      params.window.maximize();
    } else {
      const bounds: { width: number; height: number; x?: number; y?: number } = {
        width: validWidth,
        height: validHeight,
        ...(validX !== undefined ? { x: validX } : {}),
        ...(validY !== undefined ? { y: validY } : {})
      };
      params.window.setBounds(bounds);
    }

    params.logger.debug('Window state restored', { width: validWidth, height: validHeight, isMaximized });
  } catch (error: unknown) {
    // Window state file doesn't exist or is invalid - keep defaults
    params.logger.debug('Using default window state', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export function createDebouncedWindowStateSaver(params: {
  app: App;
  logger: LoggerLike;
  getWindow: () => BrowserWindow | null;
  delayMs?: number;
}): { scheduleSave: () => void } {
  let timer: NodeJS.Timeout | null = null;
  const delayMs = params.delayMs ?? 500;

  const scheduleSave = () => {
    const window = params.getWindow();
    if (!window) return;

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      void (async () => {
        try {
          const userDataPath = params.app.getPath('userData');
          const windowStatePath = path.join(userDataPath, 'window-state.json');

          const bounds = window.getBounds();
          const isMaximized = window.isMaximized();

          const windowState: WindowState = {
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            isMaximized
          };

          await fs.promises.mkdir(userDataPath, { recursive: true });
          await fs.promises.writeFile(windowStatePath, JSON.stringify(windowState, null, 2));

          params.logger.debug('Window state saved', windowState);
        } catch (error: unknown) {
          params.logger.warn('Could not save window state', { error: error instanceof Error ? error.message : String(error) });
        }
      })();
    }, delayMs);
  };

  return { scheduleSave };
}


