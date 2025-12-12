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

export function exposePreloadBridges(): void {
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
}


