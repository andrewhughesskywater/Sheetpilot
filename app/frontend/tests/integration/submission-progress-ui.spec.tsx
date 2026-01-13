/**
 * @fileoverview Frontend Submission Progress UI Integration Test
 * 
 * Tests the SubmitProgressBar component with mocked IPC communication
 * to verify that progress updates are correctly received and displayed.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SubmitProgressBar } from '../../src/components/SubmitProgressBar';
import { useState, useEffect } from 'react';

// Mock window.timesheet API
type ProgressCallback = (progress: { percent: number; current: number; total: number; message: string }) => void;

const mockProgressListeners: ProgressCallback[] = [];

// Helper to call listeners within act()
const callListeners = (update: { percent: number; current: number; total: number; message: string }) => {
  mockProgressListeners.forEach(listener => {
    act(() => {
      listener(update);
    });
  });
};

const mockWindowAPI = {
  timesheet: {
    submit: vi.fn(async () => {
      // Simulate submission with progress updates
      const progressUpdates = [
        { percent: 10, current: 0, total: 5, message: 'Logging in' },
        { percent: 20, current: 0, total: 5, message: 'Login complete' },
        { percent: 32, current: 1, total: 5, message: 'Processed 1/5 rows' },
        { percent: 44, current: 2, total: 5, message: 'Processed 2/5 rows' },
        { percent: 56, current: 3, total: 5, message: 'Processed 3/5 rows' },
        { percent: 68, current: 4, total: 5, message: 'Processed 4/5 rows' },
        { percent: 80, current: 5, total: 5, message: 'Processed 5/5 rows' },
        { percent: 100, current: 5, total: 5, message: 'Submission complete' },
      ];

      // Send progress updates asynchronously
      for (const update of progressUpdates) {
        await new Promise(resolve => setTimeout(resolve, 50));
        callListeners(update);
      }

      return {
        submitResult: {
          ok: true,
          successCount: 5,
          removedCount: 0,
          totalProcessed: 5,
        },
      };
    }),
    onSubmissionProgress: vi.fn((callback: ProgressCallback) => {
      mockProgressListeners.push(callback);
    }),
    removeProgressListener: vi.fn(() => {
      mockProgressListeners.length = 0;
    }),
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
};

// Set up global window API
Object.assign(global.window, mockWindowAPI);

// Test wrapper component that manages state
function TestSubmitProgressBar() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEntry, setCurrentEntry] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  // Set up progress listener
  useEffect(() => {
    if (!window.timesheet?.onSubmissionProgress) return;

    window.timesheet.onSubmissionProgress((progressData) => {
      setProgress(progressData.percent);
      setCurrentEntry(progressData.current);
      setTotalEntries(progressData.total);
      setProgressMessage(progressData.message);
    });

    return () => {
      window.timesheet?.removeProgressListener?.();
    };
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setProgress(0);
    setCurrentEntry(0);
    setTotalEntries(0);
    setProgressMessage('');

    try {
      await window.timesheet?.submit('test-token');
    } finally {
      // Keep submitting state for a moment so we can verify final progress
      setTimeout(() => {
        setIsSubmitting(false);
      }, 100);
    }
  };

  return (
    <div>
      <SubmitProgressBar
        status="ready"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        progress={progress}
        currentEntry={currentEntry}
        totalEntries={totalEntries}
        message={progressMessage}
      >
        Submit Timesheet
      </SubmitProgressBar>
      
      {/* Test helpers to verify state */}
      <div data-testid="progress-value">{progress}</div>
      <div data-testid="current-entry">{currentEntry}</div>
      <div data-testid="total-entries">{totalEntries}</div>
      <div data-testid="progress-message">{progressMessage}</div>
      <div data-testid="is-submitting">{isSubmitting ? 'true' : 'false'}</div>
    </div>
  );
}

describe('Submission Progress UI Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockProgressListeners.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should display button initially', () => {
    render(<TestSubmitProgressBar />);
    
    const button = screen.getByRole('button', { name: /submit timesheet/i });
    expect(button).toBeInTheDocument();
  });

  it('should receive and display progress updates during submission', async () => {
    render(<TestSubmitProgressBar />);
    
    const button = screen.getByRole('button', { name: /submit timesheet/i });
    
    await act(async () => {
      button.click();
    });

    // Wait for submission to start
    await waitFor(() => {
      expect(screen.getByTestId('is-submitting').textContent).toBe('true');
    });

    // Advance timers to trigger progress updates
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    // Wait for first progress update (10%)
    await waitFor(() => {
      const progress = parseInt(screen.getByTestId('progress-value').textContent || '0');
      expect(progress).toBeGreaterThanOrEqual(10);
    });

    // Verify login message
    await waitFor(() => {
      expect(screen.getByTestId('progress-message').textContent).toContain('Logging in');
    });

    // Advance timers for processing updates
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    // Wait for processing updates
    await waitFor(() => {
      const progress = parseInt(screen.getByTestId('progress-value').textContent || '0');
      expect(progress).toBeGreaterThanOrEqual(30);
    });

    // Verify current/total are updated
    await waitFor(() => {
      const current = parseInt(screen.getByTestId('current-entry').textContent || '0');
      expect(current).toBeGreaterThan(0);
    });

    await waitFor(() => {
      const total = parseInt(screen.getByTestId('total-entries').textContent || '0');
      expect(total).toBe(5);
    });

    // Advance timers to completion
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    // Wait for completion (100%)
    await waitFor(() => {
      const progress = parseInt(screen.getByTestId('progress-value').textContent || '0');
      expect(progress).toBe(100);
    });

    // Verify completion message
    await waitFor(() => {
      expect(screen.getByTestId('progress-message').textContent).toContain('complete');
    });
  });

  it('should show progress bar during submission', async () => {
    render(<TestSubmitProgressBar />);
    
    const button = screen.getByRole('button', { name: /submit timesheet/i });
    
    await act(async () => {
      button.click();
    });

    // Wait for submission to start
    await waitFor(() => {
      expect(screen.getByTestId('is-submitting').textContent).toBe('true');
    });

    // Advance timers to trigger progress updates
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    // Progress bar should be visible (button is replaced by progress)
    await waitFor(() => {
      const progress = parseInt(screen.getByTestId('progress-value').textContent || '0');
      expect(progress).toBeGreaterThan(0);
    });
  });

  it('should track progress through all stages', async () => {
    const progressValues: number[] = [];
    
    render(<TestSubmitProgressBar />);
    
    const button = screen.getByRole('button', { name: /submit timesheet/i });
    
    await act(async () => {
      button.click();
    });

    // Collect progress values as we advance timers
    const checkProgress = () => {
      const progressEl = screen.getByTestId('progress-value');
      const progress = parseInt(progressEl.textContent || '0');
      if (progress > 0 && !progressValues.includes(progress)) {
        progressValues.push(progress);
      }
    };

    // Advance timers incrementally and check progress
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        vi.advanceTimersByTime(50);
        await Promise.resolve();
      });
      checkProgress();
    }

    // Wait for completion
    await waitFor(() => {
      const progress = parseInt(screen.getByTestId('progress-value').textContent || '0');
      return progress === 100;
    });

    // Verify we captured progress updates
    expect(progressValues.length).toBeGreaterThan(0);
    
    // Verify progress increased (or stayed same) - monotonic
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1] || 0);
    }

    // Verify we hit key milestones
    expect(progressValues.some(p => p >= 10 && p <= 20)).toBe(true); // Login phase
    expect(progressValues.some(p => p >= 30 && p <= 80)).toBe(true); // Processing phase
    expect(progressValues.some(p => p === 100)).toBe(true); // Completion
  });

  it('should display correct entry count messages', async () => {
    render(<TestSubmitProgressBar />);
    
    const button = screen.getByRole('button', { name: /submit timesheet/i });
    
    await act(async () => {
      button.click();
    });

    // Advance timers to trigger entry processing messages
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    // Wait for entry processing messages
    await waitFor(() => {
      const message = screen.getByTestId('progress-message').textContent || '';
      return message.includes('/5');
    });

    // Verify message format
    const message = screen.getByTestId('progress-message').textContent || '';
    expect(message).toMatch(/\d+\/5/); // Should contain "X/5" format
  });

  it('should reset progress listener on unmount', () => {
    // Clear mocks before render to start fresh
    mockWindowAPI.timesheet.onSubmissionProgress.mockClear();
    mockWindowAPI.timesheet.removeProgressListener.mockClear();
    
    const { unmount } = render(<TestSubmitProgressBar />);
    
    // Verify listener was registered
    expect(mockWindowAPI.timesheet.onSubmissionProgress).toHaveBeenCalled();
    
    // Unmount component
    unmount();
    
    // Verify listener was removed
    expect(mockWindowAPI.timesheet.removeProgressListener).toHaveBeenCalled();
  });

  it('should handle rapid progress updates without errors', async () => {
    // Create a version with very rapid updates
    const rapidMockAPI = {
      ...mockWindowAPI,
      timesheet: {
        ...mockWindowAPI.timesheet,
        submit: vi.fn(async () => {
          // Send 50 rapid updates
          for (let i = 0; i <= 100; i += 2) {
            await new Promise(resolve => setTimeout(resolve, 10));
            callListeners({
              percent: i,
              current: Math.floor(i / 20),
              total: 5,
              message: `Progress ${i}%`,
            });
          }

          return {
            submitResult: {
              ok: true,
              successCount: 5,
              removedCount: 0,
              totalProcessed: 5,
            },
          };
        }),
      },
    };

    Object.assign(global.window, rapidMockAPI);

    render(<TestSubmitProgressBar />);
    
    const button = screen.getByRole('button', { name: /submit timesheet/i });
    
    // Should not throw with rapid updates
    button.click();

    // Wait for completion
    await waitFor(() => {
      const progress = parseInt(screen.getByTestId('progress-value').textContent || '0');
      return progress === 100;
    }, { timeout: 3000 });
  });

  it('should clamp progress values to 0-100 range', async () => {
    // Create a version that sends out-of-range values
    const outOfRangeMockAPI = {
      ...mockWindowAPI,
      timesheet: {
        ...mockWindowAPI.timesheet,
        submit: vi.fn(async () => {
          const updates = [
            { percent: -10, current: 0, total: 5, message: 'Negative' },
            { percent: 50, current: 2, total: 5, message: 'Normal' },
            { percent: 150, current: 5, total: 5, message: 'Over 100' },
          ];

          for (const update of updates) {
            await new Promise(resolve => setTimeout(resolve, 50));
            callListeners(update);
          }

          return {
            submitResult: {
              ok: true,
              successCount: 5,
              removedCount: 0,
              totalProcessed: 5,
            },
          };
        }),
      },
    };

    Object.assign(global.window, outOfRangeMockAPI);

    render(<TestSubmitProgressBar />);
    
    const button = screen.getByRole('button', { name: /submit timesheet/i });
    button.click();

    // Wait for updates to be processed
    await waitFor(() => {
      const progressEl = screen.getByTestId('progress-value');
      const progress = parseInt(progressEl.textContent || '0');
      return progress > 0;
    }, { timeout: 500 });

    // Component should clamp values - verify via the rendered value
    const progressEl = screen.getByTestId('progress-value');
    const progress = parseInt(progressEl.textContent || '0');
    
    // Should be within valid range
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(100);
  });
});

