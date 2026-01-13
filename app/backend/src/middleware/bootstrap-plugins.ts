/**
 * @fileoverview Plugin Bootstrap
 * 
 * Registers all default plugins with the plugin registry.
 * Called during application startup.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { LoggerLike } from '../bootstrap/logging/logger-contract';
import { PluginRegistry } from '../../../shared/plugin-registry';
import { loadPluginConfig } from '../../../shared/plugin-config';
import { SQLiteDataService } from '../services/plugins/sqlite-data-service';
import { MemoryDataService } from '../services/plugins/memory-data-service';
import { SQLiteCredentialService } from '../services/plugins/sqlite-credential-service';
import { ElectronBotService } from '../services/plugins/electron-bot-service';
import { MockSubmissionService } from '../services/plugins/mock-submission-service';
import * as path from 'path';

/**
 * Register all default plugins with the registry
 */
export async function registerDefaultPlugins(logger: LoggerLike): Promise<void> {
  const registry = PluginRegistry.getInstance();
  
  // Load configuration
  const configPath = path.join(process.cwd(), 'plugin-config.json');
  const config = loadPluginConfig(configPath);
  registry.loadConfig(config);
  
  // Register data services
  await registry.registerPlugin('data', 'sqlite', new SQLiteDataService());
  await registry.registerPlugin('data', 'memory', new MemoryDataService());
  
  // Register credential services
  await registry.registerPlugin('credentials', 'sqlite', new SQLiteCredentialService());
  
  // Register submission services
  await registry.registerPlugin('submission', 'electron', new ElectronBotService());
  await registry.registerPlugin('submission', 'mock', new MockSubmissionService());
  
  logger.info('Default plugins registered successfully');
  logger.verbose('Active plugins configured', {
    data: registry.getActivePluginName('data'),
    credentials: registry.getActivePluginName('credentials'),
    submission: registry.getActivePluginName('submission')
  });
}

/**
 * Get the active data service
 */
export function getDataService() {
  const registry = PluginRegistry.getInstance();
  return registry.getPlugin('data');
}

/**
 * Get the active credential service
 */
export function getCredentialService() {
  const registry = PluginRegistry.getInstance();
  return registry.getPlugin('credentials');
}

/**
 * Get the active submission service
 */
export function getSubmissionService() {
  const registry = PluginRegistry.getInstance();
  return registry.getPlugin('submission');
}

