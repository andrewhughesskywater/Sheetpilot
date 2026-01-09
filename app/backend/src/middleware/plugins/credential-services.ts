/**
 * @fileoverview Credential Service Plugin Registration
 *
 * Handles registration of credential service plugins.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { SQLiteCredentialService } from '../../services/plugins/sqlite-credential-service';
import { getRegistry } from '../utils/registry';

/**
 * Register all credential service plugins
 */
export async function registerCredentialServices(): Promise<void> {
  const registry = getRegistry();

  await registry.registerPlugin('credentials', 'sqlite', new SQLiteCredentialService());
}
