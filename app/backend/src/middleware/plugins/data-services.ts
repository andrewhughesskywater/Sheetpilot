/**
 * @fileoverview Data Service Plugin Registration
 *
 * Handles registration of data service plugins.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { MemoryDataService } from '../../services/plugins/memory-data-service';
import { SQLiteDataService } from '../../services/plugins/sqlite-data-service';
import { getRegistry } from '../utils/registry';

/**
 * Register all data service plugins
 */
export async function registerDataServices(): Promise<void> {
  const registry = getRegistry();

  await registry.registerPlugin('data', 'sqlite', new SQLiteDataService());
  await registry.registerPlugin('data', 'memory', new MemoryDataService());
}
