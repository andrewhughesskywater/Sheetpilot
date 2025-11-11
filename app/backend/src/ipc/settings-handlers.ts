import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { ipcLogger } from '../../../shared/logger';

/**
 * Settings Handlers
 * Manages application settings storage and retrieval
 */

interface AppSettings {
  browserHeadless?: boolean;
}

const getSettingsPath = (): string => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'settings.json');
};

const loadSettings = (): AppSettings => {
  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    ipcLogger.error('Could not load settings', { 
      settingsPath, 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
  return {};
};

const saveSettings = (settings: AppSettings): void => {
  const settingsPath = getSettingsPath();
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    ipcLogger.error('Could not save settings', { 
      settingsPath, 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
};

export function registerSettingsHandlers(): void {
  // Initialize browser headless mode from settings file on startup
  try {
    const settingsPath = getSettingsPath();
    const settings = loadSettings();
    // Default to false (headless OFF = visible browser) for better user experience
    const headlessValue = settings.browserHeadless ?? false;
    
    // Update the shared constant
    setBrowserHeadless(headlessValue);
    
    // Use console.log for startup message to ensure it's visible
    console.log('[Settings] Initialized browserHeadless on startup:', { 
      settingsPath,
      savedValue: settings.browserHeadless, 
      effectiveValue: headlessValue
    });
    
    ipcLogger.info('Initialized browserHeadless setting on startup', { 
      savedValue: settings.browserHeadless, 
      effectiveValue: headlessValue
    });
  } catch (err) {
    console.error('[Settings] Could not initialize settings on startup', err);
    ipcLogger.error('Could not initialize settings on startup', { 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
  
  ipcMain.handle('settings:get', async (_event, key: string) => {
    try {
      const settings = loadSettings();
      return { success: true, value: settings[key as keyof AppSettings] };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: unknown) => {
    try {
      const settingsPath = getSettingsPath();
      const settings = loadSettings();
      (settings as Record<string, unknown>)[key] = value;
      saveSettings(settings);
      
      // Verify the setting was saved by reloading
      const verifiedSettings = loadSettings();
      const savedCorrectly = verifiedSettings[key as keyof AppSettings] === value;
      
      ipcLogger.info('Setting saved successfully', { 
        key, 
        value, 
        savedValue: verifiedSettings[key as keyof AppSettings],
        verified: savedCorrectly,
        settingsPath 
      });
      
      // If headless mode changed, update the shared constant immediately
      if (key === 'browserHeadless') {
        setBrowserHeadless(Boolean(value));
        console.log('[Settings] Updated browserHeadless setting:', { 
          toggleValue: value,
          meaning: value ? 'Browser will be INVISIBLE (headless)' : 'Browser will be VISIBLE (non-headless)'
        });
        ipcLogger.info('Updated browserHeadless setting', { 
          toggleValue: value,
          meaning: value ? 'Browser will be INVISIBLE (headless)' : 'Browser will be VISIBLE (non-headless)'
        });
      }
      
      if (!savedCorrectly) {
        throw new Error(`Setting was not saved correctly. Expected ${value}, got ${verifiedSettings[key as keyof AppSettings]}`);
      }
      
      return { success: true };
    } catch (err) {
      ipcLogger.error('Could not save setting', { 
        key, 
        value, 
        error: err instanceof Error ? err.message : String(err) 
      });
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('settings:getAll', async () => {
    try {
      const settings = loadSettings();
      return { success: true, settings };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  });
}

