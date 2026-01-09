import { registerDefaultPlugins } from '../../middleware/bootstrap-plugins';
import type { LoggerLike } from '../logging/logger-contract';

export async function registerDefaultPluginsBootstrap(logger: LoggerLike): Promise<void> {
  logger.verbose('Registering default plugins');
  await registerDefaultPlugins();
  logger.verbose('Default plugins registered');
}
