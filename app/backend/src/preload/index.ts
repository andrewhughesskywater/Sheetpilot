import { contextBridge } from 'electron';
import { apiBridge } from './bridges/api';
import { timesheetBridge } from './bridges/timesheet';
import { credentialsBridge } from './bridges/credentials';
import { authBridge } from './bridges/auth';
import { adminBridge } from './bridges/admin';
import { databaseBridge } from './bridges/database';
import { logsBridge } from './bridges/logs';
import { loggerBridge } from './bridges/logger';
import { updatesBridge } from './bridges/updates';
import { settingsBridge } from './bridges/settings';
import { cspBridge } from './bridges/csp';

export function exposePreloadBridges(): void {
  // Log that preload script is executing
  console.log('[Preload] Preload script executing');
  
  try {
    if (!contextBridge) {
      throw new Error('contextBridge is not available');
    }
    
    contextBridge.exposeInMainWorld('api', apiBridge);
    contextBridge.exposeInMainWorld('timesheet', timesheetBridge);
    contextBridge.exposeInMainWorld('credentials', credentialsBridge);
    contextBridge.exposeInMainWorld('auth', authBridge);
    contextBridge.exposeInMainWorld('admin', adminBridge);
    contextBridge.exposeInMainWorld('database', databaseBridge);
    contextBridge.exposeInMainWorld('logs', logsBridge);
    contextBridge.exposeInMainWorld('logger', loggerBridge);
    contextBridge.exposeInMainWorld('updates', updatesBridge);
    contextBridge.exposeInMainWorld('settings', settingsBridge);
    contextBridge.exposeInMainWorld('csp', cspBridge);
    
    // Verify auth bridge was exposed
    if (typeof window !== 'undefined' && (window as unknown as { auth?: unknown }).auth) {
      console.log('[Preload] All bridges exposed successfully - auth API verified');
    } else {
      console.warn('[Preload] Bridges exposed but window.auth not accessible (may be context isolation)');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Preload] Failed to expose bridges:', errorMsg, errorStack);
    
    // Try to expose at least auth bridge even if others fail
    try {
      contextBridge.exposeInMainWorld('auth', authBridge);
      console.log('[Preload] Auth bridge exposed as fallback');
    } catch (authError) {
      const authErrorMsg = authError instanceof Error ? authError.message : String(authError);
      console.error('[Preload] Failed to expose auth bridge:', authErrorMsg);
      throw authError; // Re-throw to surface the error
    }
  }
}


