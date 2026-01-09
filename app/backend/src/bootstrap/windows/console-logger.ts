/**
 * Per-window console message filter with deduplication.
 *
 * Prevents log spam from repeated renderer console messages while preserving
 * visibility into unique errors. Uses LRU cache (last 50 messages per window)
 * and deduplicates by [level, message] hash.
 *
 * When a duplicate is detected, increments an internal counter and logs
 * the deduplicated message once per 10 occurrences to provide signal
 * without overwhelming logs.
 */

import type { LoggerLike } from '../logging/logger-contract';

export interface ConsoleMessageContext {
  line: number;
  sourceId: string;
  webContentsId: number;
}

/**
 * LRU cache entry for console messages with dedup counter.
 */
interface CacheEntry {
  timestamp: number;
  count: number;
  key: string; // [level, message] hash for dedup
}

/**
 * Per-window console message filter with LRU cache and deduplication.
 */
export class PerWindowConsoleFilter {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize = 50;
  private readonly reportDupInterval = 10;
  private readonly webContentsId: number;
  private readonly logger: LoggerLike;

  constructor(webContentsId: number, logger: LoggerLike) {
    this.webContentsId = webContentsId;
    this.logger = logger;
  }

  /**
   * Filter and optionally deduplicate console message.
   * Returns true if message should be logged, false if deduplicated.
   */
  filter(level: number, message: string, line: number, sourceId: string): boolean {
    const key = this.createKey(level, message);
    const entry = this.cache.get(key);

    if (entry) {
      // Duplicate detected
      entry.count++;
      entry.timestamp = Date.now();

      // Report every N duplicates to provide signal
      if (entry.count % this.reportDupInterval === 0) {
        this.logger.warn(`[Renderer] Duplicate message (×${entry.count}): ${message}`, {
          level,
          line,
          sourceId,
          webContentsId: this.webContentsId,
          deduplicatedCount: entry.count,
        });
      }

      return false; // Don't log this message
    }

    // First occurrence - add to cache
    this.cache.set(key, {
      key,
      timestamp: Date.now(),
      count: 1,
    });

    // Evict oldest entry if cache is full (LRU)
    if (this.cache.size > this.maxCacheSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    return true; // Log this message
  }

  /**
   * Clear cache (e.g., when window closes).
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (for testing/debugging).
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Create dedup key from level and message.
   */
  private createKey(level: number, message: string): string {
    return `${level}:${message}`;
  }
}

/**
 * Map of console filters per window (webContentsId → filter).
 */
export class ConsoleLoggerManager {
  private readonly filters = new Map<number, PerWindowConsoleFilter>();
  private readonly logger: LoggerLike;

  constructor(logger: LoggerLike) {
    this.logger = logger;
  }

  /**
   * Get or create filter for webContentsId.
   */
  getFilter(webContentsId: number): PerWindowConsoleFilter {
    let filter = this.filters.get(webContentsId);
    if (!filter) {
      filter = new PerWindowConsoleFilter(webContentsId, this.logger);
      this.filters.set(webContentsId, filter);
    }
    return filter;
  }

  /**
   * Remove filter when window closes (cleanup).
   */
  removeFilter(webContentsId: number): void {
    this.filters.delete(webContentsId);
  }

  /**
   * Convert Chromium console level (0-3) to logger method name.
   */
  static getLevelName(level: number): 'debug' | 'info' | 'warn' | 'error' {
    switch (level) {
      case 0:
        return 'debug';
      case 1:
        return 'info';
      case 2:
        return 'warn';
      case 3:
        return 'error';
      default:
        return 'info';
    }
  }
}
