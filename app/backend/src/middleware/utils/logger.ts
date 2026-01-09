/**
 * @fileoverview Middleware Logger Utility
 * 
 * Internal logger for the middleware module.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { appLogger } from '@sheetpilot/shared/logger';

export const middlewareLogger = appLogger.child({ module: 'Middleware' });
