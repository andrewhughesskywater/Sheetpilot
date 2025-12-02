import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, useDebounceCallback } from '../../src/utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const func = vi.fn();
      const debounced = debounce(func, 100);

      debounced();
      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous call when called again', () => {
      const func = vi.fn();
      const debounced = debounce(func, 100);

      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);
      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', () => {
      const func = vi.fn();
      const debounced = debounce(func, 100);

      debounced('arg1', 'arg2', 123);
      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should handle multiple rapid calls', () => {
      const func = vi.fn();
      const debounced = debounce(func, 100);

      debounced();
      debounced();
      debounced();
      debounced();
      debounced();

      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should work with different wait times', () => {
      const func = vi.fn();
      const debounced = debounce(func, 200);

      debounced();
      vi.advanceTimersByTime(100);
      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should handle zero wait time', () => {
      const func = vi.fn();
      const debounced = debounce(func, 0);

      debounced();
      vi.advanceTimersByTime(0);
      expect(func).toHaveBeenCalledTimes(1);
    });
  });

  describe('useDebounceCallback', () => {
    it('should return debounced function', () => {
      const callback = vi.fn();
      const debounced = useDebounceCallback(callback, 100);

      expect(typeof debounced).toBe('function');
    });

    it('should debounce callback execution', () => {
      const callback = vi.fn();
      const debounced = useDebounceCallback(callback, 100);

      debounced();
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to callback', () => {
      const callback = vi.fn();
      const debounced = useDebounceCallback(callback, 100);

      debounced('test', 123);
      vi.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledWith('test', 123);
    });
  });
});


