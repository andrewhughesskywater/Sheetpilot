import type { LoggerLike } from '../logging/logger-contract';
import { registerDefaultPlugins } from '../../middleware/bootstrap-plugins';

export async function registerDefaultPluginsBootstrap(logger: LoggerLike): Promise<void> {
  logger.verbose('Registering default plugins');
  await registerDefaultPlugins(logger);
  logger.verbose('Default plugins registered');
}


