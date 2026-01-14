import { describe, it, expect, vi, beforeEach, afterEach as _afterEach } from 'vitest';
import { checkAborted, createCancelledResult, setupAbortHandler } from '@sheetpilot/bot';
import { botLogger } from '@sheetpilot/shared/logger';

// Mock logger
vi.mock('../../../../../shared/logger', () => ({
  botLogger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('abort-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAborted', () => {
    it('should not throw when abortSignal is undefined', () => {
      expect(() => checkAborted(undefined, 'test')).not.toThrow();
    });

    it('should not throw when abortSignal is not aborted', () => {
      const controller = new AbortController();
      expect(() => checkAborted(controller.signal, 'test')).not.toThrow();
    });

    it('should throw error when abortSignal is aborted', () => {
      const controller = new AbortController();
      controller.abort();
      
      expect(() => checkAborted(controller.signal, 'submission')).toThrow('submission was cancelled');
      expect(botLogger.info).toHaveBeenCalledWith('submission aborted before starting');
    });

    it('should log with correct context', () => {
      const controller = new AbortController();
      controller.abort();
      
      expect(() => checkAborted(controller.signal, 'automation')).toThrow('automation was cancelled');
      expect(botLogger.info).toHaveBeenCalledWith('automation aborted before starting');
    });
  });

  describe('createCancelledResult', () => {
    it('should create result with correct structure', () => {
      const result = createCancelledResult(5);
      
      expect(result).toEqual({
        ok: false,
        submittedIds: [],
        removedIds: [],
        totalProcessed: 5,
        successCount: 0,
        removedCount: 0,
        error: 'Submission was cancelled'
      });
    });

    it('should handle zero entry count', () => {
      const result = createCancelledResult(0);
      expect(result.totalProcessed).toBe(0);
    });

    it('should handle large entry count', () => {
      const result = createCancelledResult(100);
      expect(result.totalProcessed).toBe(100);
    });
  });

  describe('setupAbortHandler', () => {
    it('should return undefined when abortSignal is undefined', () => {
      const closeResource = vi.fn().mockResolvedValue(undefined);
      const cleanup = setupAbortHandler(undefined, closeResource, 'test');
      
      expect(cleanup).toBeUndefined();
    });

    it('should set up abort handler and return cleanup function', () => {
      const controller = new AbortController();
      const closeResource = vi.fn().mockResolvedValue(undefined);
      
      const cleanup = setupAbortHandler(controller.signal, closeResource, 'test-resource');
      
      expect(cleanup).toBeDefined();
      expect(typeof cleanup).toBe('function');
    });

    it('should call closeResource when abort signal is triggered', async () => {
      const controller = new AbortController();
      const closeResource = vi.fn().mockResolvedValue(undefined);
      
      setupAbortHandler(controller.signal, closeResource, 'test-resource');
      
      controller.abort();
      
      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(closeResource).toHaveBeenCalled();
      expect(botLogger.info).toHaveBeenCalledWith(
        'Abort signal received, closing resource immediately',
        { resourceName: 'test-resource' }
      );
    });

    it('should log error when closeResource fails', async () => {
      const controller = new AbortController();
      const error = new Error('Close failed');
      const closeResource = vi.fn().mockRejectedValue(error);
      
      setupAbortHandler(controller.signal, closeResource, 'test-resource');
      
      controller.abort();
      
      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(botLogger.error).toHaveBeenCalledWith(
        'Could not close resource during abort',
        {
          resourceName: 'test-resource',
          error: 'Close failed'
        }
      );
    });

    it('should handle non-Error rejection', async () => {
      const controller = new AbortController();
      const closeResource = vi.fn().mockRejectedValue('String error');
      
      setupAbortHandler(controller.signal, closeResource, 'test-resource');
      
      controller.abort();
      
      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(botLogger.error).toHaveBeenCalledWith(
        'Could not close resource during abort',
        {
          resourceName: 'test-resource',
          error: 'String error'
        }
      );
    });

    it('should remove event listener when cleanup is called', async () => {
      const controller = new AbortController();
      const closeResource = vi.fn().mockResolvedValue(undefined);
      
      const cleanup = setupAbortHandler(controller.signal, closeResource, 'test-resource');
      
      // Call cleanup before abort
      if (cleanup) {
        cleanup();
      }
      
      controller.abort();
      
      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // closeResource should not be called because listener was removed
      expect(closeResource).not.toHaveBeenCalled();
    });

    it('should use default resource name when not provided', async () => {
      const controller = new AbortController();
      const closeResource = vi.fn().mockResolvedValue(undefined);
      
      setupAbortHandler(controller.signal, closeResource);
      
      controller.abort();
      
      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(botLogger.info).toHaveBeenCalledWith(
        'Abort signal received, closing resource immediately',
        { resourceName: 'resource' }
      );
    });
  });
});


