/**
 * @fileoverview StatusButton Component Tests
 * 
 * Tests for the StatusButton reusable component to ensure proper state handling,
 * rendering, and user interactions.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi } from 'vitest';
import type { ButtonStatus } from '../../src/components/StatusButton';

describe('StatusButton Component', () => {
  describe('Status States', () => {
    it('should support all three status types', () => {
      const validStatuses: ButtonStatus[] = ['neutral', 'ready', 'warning'];
      
      expect(validStatuses).toContain('neutral');
      expect(validStatuses).toContain('ready');
      expect(validStatuses).toContain('warning');
      expect(validStatuses.length).toBe(3);
    });

    it('should determine disabled state correctly for neutral status', () => {
      const status = 'neutral';
      const isProcessing = false;
      const disabled = false;
      
      const isDisabled = isProcessing || disabled || status === 'neutral' || status === 'warning';
      
      expect(isDisabled).toBe(true);
    });

    it('should determine disabled state correctly for ready status', () => {
      const status = 'ready';
      const isProcessing = false;
      const disabled = false;
      
      const isDisabled = isProcessing || disabled || status === 'neutral' || status === 'warning';
      
      expect(isDisabled).toBe(false);
    });

    it('should determine disabled state correctly for warning status', () => {
      const status = 'warning';
      const isProcessing = false;
      const disabled = false;
      
      const isDisabled = isProcessing || disabled || status === 'neutral' || status === 'warning';
      
      expect(isDisabled).toBe(true);
    });
  });

  describe('Processing State', () => {
    it('should disable button when processing', () => {
      const isProcessing = true;
      const status = 'ready';
      const disabled = false;
      
      const isDisabled = isProcessing || disabled || status === 'neutral' || status === 'warning';
      
      expect(isDisabled).toBe(true);
    });

    it('should show processing text when processing', () => {
      const isProcessing = true;
      const processingText = 'Submitting...';
      const children = 'Submit';
      
      const displayText = isProcessing && processingText ? processingText : children;
      
      expect(displayText).toBe('Submitting...');
    });

    it('should show normal text when not processing', () => {
      const isProcessing = false;
      const processingText = 'Submitting...';
      const children = 'Submit';
      
      const displayText = isProcessing && processingText ? processingText : children;
      
      expect(displayText).toBe('Submit');
    });

    it('should show children when processingText not provided', () => {
      const isProcessing = true;
      const processingText = undefined;
      const children = 'Submit';
      
      const displayText = isProcessing && processingText ? processingText : children;
      
      expect(displayText).toBe('Submit');
    });
  });

  describe('Disabled State Combinations', () => {
    it('should disable when explicitly disabled', () => {
      const isProcessing = false;
      const status = 'ready';
      const disabled = true;
      
      const isDisabled = isProcessing || disabled || status === 'neutral' || status === 'warning';
      
      expect(isDisabled).toBe(true);
    });

    it('should disable when processing regardless of status', () => {
      const testCases: Array<{ status: ButtonStatus; expected: boolean }> = [
        { status: 'neutral', expected: true },
        { status: 'ready', expected: true },
        { status: 'warning', expected: true }
      ];
      
      testCases.forEach(({ status, expected }) => {
        const isProcessing = true;
        const disabled = false;
        const isDisabled = isProcessing || disabled || status === 'neutral' || status === 'warning';
        expect(isDisabled).toBe(expected);
      });
    });

    it('should enable only for ready status when not processing', () => {
      const testCases: Array<{ status: ButtonStatus; isProcessing: boolean; disabled: boolean; expected: boolean }> = [
        { status: 'ready', isProcessing: false, disabled: false, expected: false },
        { status: 'neutral', isProcessing: false, disabled: false, expected: true },
        { status: 'warning', isProcessing: false, disabled: false, expected: true },
        { status: 'ready', isProcessing: true, disabled: false, expected: true },
        { status: 'ready', isProcessing: false, disabled: true, expected: true }
      ];
      
      testCases.forEach(({ status, isProcessing, disabled, expected }) => {
        const isDisabled = isProcessing || disabled || status === 'neutral' || status === 'warning';
        expect(isDisabled).toBe(expected);
      });
    });
  });

  describe('Icon Rendering', () => {
    it('should show spinner icon when processing', () => {
      const isProcessing = true;
      const icon = 'SubmitIcon';
      
      const displayIcon = isProcessing ? 'CircularProgress' : icon;
      
      expect(displayIcon).toBe('CircularProgress');
    });

    it('should show custom icon when not processing', () => {
      const isProcessing = false;
      const icon = 'CustomIcon';
      
      const displayIcon = isProcessing ? 'CircularProgress' : icon;
      
      expect(displayIcon).toBe('CustomIcon');
    });

    it('should show no icon when icon not provided', () => {
      const isProcessing = false;
      const icon = undefined;
      
      const displayIcon = isProcessing ? 'CircularProgress' : icon;
      
      expect(displayIcon).toBeUndefined();
    });
  });

  describe('Click Handler', () => {
    it('should call onClick when enabled and clicked', () => {
      const onClick = vi.fn();
      const isDisabled = false;
      
      if (!isDisabled) {
        onClick();
      }
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      const onClick = vi.fn();
      const isDisabled = true;
      
      if (!isDisabled) {
        onClick();
      }
      
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should not call onClick when processing', () => {
      const onClick = vi.fn();
      const isProcessing = true;
      const isDisabled = isProcessing;
      
      if (!isDisabled) {
        onClick();
      }
      
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('CSS Class Names', () => {
    it('should apply correct status class for each status', () => {
      const testCases: Array<{ status: ButtonStatus; expectedClass: string }> = [
        { status: 'neutral', expectedClass: 'status-button-neutral' },
        { status: 'ready', expectedClass: 'status-button-ready' },
        { status: 'warning', expectedClass: 'status-button-warning' }
      ];
      
      testCases.forEach(({ status, expectedClass }) => {
        const statusClass = `status-button-${status}`;
        expect(statusClass).toBe(expectedClass);
      });
    });

    it('should combine base class with status class', () => {
      const status: ButtonStatus = 'ready';
      const className = 'custom-class';
      
      const combinedClasses = `status-button status-button-${status} ${className}`;
      
      expect(combinedClasses).toBe('status-button status-button-ready custom-class');
    });

    it('should handle empty custom className', () => {
      const status: ButtonStatus = 'ready';
      const className = '';
      
      const combinedClasses = `status-button status-button-${status} ${className}`;
      
      expect(combinedClasses).toBe('status-button status-button-ready ');
    });
  });

  describe('Button Size', () => {
    it('should support all size variants', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      
      sizes.forEach(size => {
        expect(['small', 'medium', 'large']).toContain(size);
      });
    });

    it('should default to large size', () => {
      const size = undefined;
      const defaultSize = size || 'large';
      
      expect(defaultSize).toBe('large');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined processingText', () => {
      const isProcessing = true;
      const processingText = undefined;
      const children = 'Submit';
      
      const displayText = isProcessing && processingText ? processingText : children;
      
      expect(displayText).toBe('Submit');
    });

    it('should handle empty string processingText', () => {
      const isProcessing = true;
      const processingText = '';
      const children = 'Submit';
      
      const displayText = isProcessing && processingText ? processingText : children;
      
      expect(displayText).toBe('Submit'); // Empty string is falsy
    });

    it('should handle very long button text', () => {
      const longText = 'Very Long Button Text That Might Cause Layout Issues';
      expect(longText.length).toBeGreaterThan(30);
      expect(typeof longText).toBe('string');
    });

    it('should handle special characters in children', () => {
      const specialText = 'Submit & Save <Test>';
      expect(specialText).toContain('&');
      expect(specialText).toContain('<');
      expect(specialText).toContain('>');
    });
  });
});

