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

import * as path from 'path';

import { registerCredentialServices } from './plugins/credential-services';
import { registerDataServices } from './plugins/data-services';
import { registerSubmissionServices } from './plugins/submission-services';
import { middlewareLogger } from './utils/logger';
import { getRegistry, loadRegistryConfig } from './utils/registry';

/**
 * Register all default plugins with the registry
 */
export async function registerDefaultPlugins(): Promise<void> {
  const registry = getRegistry();

  // Load configuration
  const configPath = path.join(process.cwd(), 'plugin-config.json');
  loadRegistryConfig(configPath);

  // Register all plugin types
  await registerDataServices();
  await registerCredentialServices();
  await registerSubmissionServices();

  middlewareLogger.info('Default plugins registered successfully');
  middlewareLogger.verbose('Active plugins configured', {
    data: registry.getActivePluginName('data'),
    credentials: registry.getActivePluginName('credentials'),
    submission: registry.getActivePluginName('submission'),
  });
}

/**
 * Get the active data service
 */
export function getDataService() {
  return getRegistry().getPlugin('data');
}

/**
 * Get the active credential service
 */
export function getCredentialService() {
  return getRegistry().getPlugin('credentials');
}

/**
 * Get the active submission service
 */
export function getSubmissionService() {
  return getRegistry().getPlugin('submission');
}
