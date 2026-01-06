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

/**
 * Validate and coerce WindowState from partial data.
 * Returns valid state with defaults for missing/invalid fields.
 * Logs discrepancies instead of throwing to prevent crashes on corrupted state.
 */
export function validateWindowState(data: unknown, logger: LoggerLike, defaults: WindowState): WindowState {
  if (!data || typeof data !== 'object') {
    logger.debug('Invalid window state (not an object), using defaults', { type: typeof data });
    return defaults;
  }

  const partial = data as Record<string, unknown>;

  // Validate width
  const partialWidth = partial['width'];
  const width = typeof partialWidth === 'number' && partialWidth > 0
    ? Math.round(partialWidth)
    : defaults.width;
  if (typeof partialWidth !== 'number' || partialWidth <= 0) {
    logger.debug('Invalid window width, using default', { provided: partialWidth, default: defaults.width });
  }

  // Validate height
  const partialHeight = partial['height'];
  const height = typeof partialHeight === 'number' && partialHeight > 0
    ? Math.round(partialHeight)
    : defaults.height;
  if (typeof partialHeight !== 'number' || partialHeight <= 0) {
    logger.debug('Invalid window height, using default', { provided: partialHeight, default: defaults.height });
  }

  // Validate x (optional, must be non-negative)
  const partialX = partial['x'];
  const x = (typeof partialX === 'number' && partialX >= 0)
    ? Math.round(partialX)
    : undefined;
  if (typeof partialX === 'number' && partialX < 0) {
    logger.debug('Invalid window x coordinate, using default', { provided: partialX });
  }

  // Validate y (optional, must be non-negative)
  const partialY = partial['y'];
  const y = (typeof partialY === 'number' && partialY >= 0)
    ? Math.round(partialY)
    : undefined;
  if (typeof partialY === 'number' && partialY < 0) {
    logger.debug('Invalid window y coordinate, using default', { provided: partialY });
  }

  // Validate isMaximized (optional, must be boolean)
  const partialIsMaximized = partial['isMaximized'];
  const isMaximized = typeof partialIsMaximized === 'boolean'
    ? partialIsMaximized
    : defaults.isMaximized;

  return {
    width,
    height,
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
    ...(isMaximized !== undefined ? { isMaximized } : {})
  };
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
    const parsed = JSON.parse(data);

    // Get defaults for validation
    const defaults = getDefaultWindowState();

    // Validate and coerce state from file (handles corrupted JSON gracefully)
    const savedState = validateWindowState(parsed, params.logger, defaults);

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


