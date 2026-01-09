/**
 * @fileoverview Submission Service Plugin Registration
 *
 * Handles registration of submission service plugins.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { ElectronBotService } from '../../services/plugins/electron-bot-service';
import { MockSubmissionService } from '../../services/plugins/mock-submission-service';
import { getRegistry } from '../utils/registry';

/**
 * Register all submission service plugins
 */
export async function registerSubmissionServices(): Promise<void> {
  const registry = getRegistry();

  await registry.registerPlugin('submission', 'electron', new ElectronBotService());
  await registry.registerPlugin('submission', 'mock', new MockSubmissionService());
}
