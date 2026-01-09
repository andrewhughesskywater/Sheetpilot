/**
 * @fileoverview Abort Signal Utilities
 *
 * Shared utilities for handling abort signals in bot operations.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { botLogger } from '../../utils/logger';

/**
 * Checks if an abort signal is already aborted and throws if so
 * @param abortSignal - Optional abort signal to check (supports both AbortSignal and simplified {aborted: boolean} type)
 * @param context - Context string for logging (e.g., 'submission', 'automation')
 * @throws Error if signal is aborted
 */
export function checkAborted(
  abortSignal: AbortSignal | { aborted: boolean; reason?: unknown } | undefined,
  context: string
): void {
  if (abortSignal?.aborted) {
    const message = `${context} was cancelled`;
    botLogger.info(`${context} aborted before starting`);
    throw new Error(message);
  }
}

/**
 * Creates a cancelled result object for bot operations
 * @param entryCount - Number of entries that were not processed
 * @returns Result object indicating cancellation
 */
export function createCancelledResult(entryCount: number) {
  return {
    ok: false,
    submittedIds: [] as number[],
    removedIds: [] as number[],
    totalProcessed: entryCount,
    successCount: 0,
    removedCount: 0,
    error: 'Submission was cancelled',
  };
}

/**
 * Sets up an abort handler that closes a resource when aborted
 * @param abortSignal - Optional abort signal
 * @param closeResource - Function to close the resource
 * @param resourceName - Name of resource for logging
 * @returns Cleanup function to remove the event listener
 */
export function setupAbortHandler(
  abortSignal: AbortSignal | undefined,
  closeResource: () => Promise<void>,
  resourceName: string = 'resource'
): (() => void) | undefined {
  if (!abortSignal) {
    return undefined;
  }

  const abortHandler = () => {
    botLogger.info('Abort signal received, closing resource immediately', { resourceName });
    closeResource().catch((err) => {
      botLogger.error('Could not close resource during abort', {
        resourceName,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  };

  abortSignal.addEventListener('abort', abortHandler);

  return () => {
    abortSignal.removeEventListener('abort', abortHandler);
  };
}
