import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeyboardShortcutsHintDialog from '@/components/KeyboardShortcutsHintDialog';

describe('KeyboardShortcutsHintDialog', () => {
  let mockLocalStorage: Storage;
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    mockLocalStorage = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(storage).forEach((key) => delete storage[key]);
      }),
      get length() {
        return Object.keys(storage).length;
      },
      key: vi.fn((index: number) => Object.keys(storage)[index] || null),
    } as Storage;
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should render when open', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsHintDialog open={true} onClose={onClose} />);

    expect(screen.getByText('Helpful Hints')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsHintDialog open={false} onClose={onClose} />);

    expect(screen.queryByText('Helpful Hints')).not.toBeInTheDocument();
  });

  it('should close dialog when dontShowAgain flag is set', () => {
    const onClose = vi.fn();
    mockLocalStorage.setItem('sheetpilot-hide-shortcuts-hint', 'true');

    render(<KeyboardShortcutsHintDialog open={true} onClose={onClose} />);

    expect(onClose).toHaveBeenCalled();
  });

  it('should save timestamp on first open', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsHintDialog open={true} onClose={onClose} />);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('sheetpilot-shortcuts-hint-last-shown', expect.any(String));
  });

  it('should handle close button click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<KeyboardShortcutsHintDialog open={true} onClose={onClose} />);

    // Navigate to page 2 first (page 1 has "Next", page 2 has "Got it")
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // "Got it" is the close/confirm button on page 2
    const closeButton = screen.getByRole('button', { name: /got it/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should save dontShowAgain preference when checkbox is checked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<KeyboardShortcutsHintDialog open={true} onClose={onClose} />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    // Navigate to page 2 and click "Got it" to close
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    const closeButton = screen.getByRole('button', { name: /got it/i });
    await user.click(closeButton);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('sheetpilot-hide-shortcuts-hint', 'true');
  });

  it('should navigate between pages', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<KeyboardShortcutsHintDialog open={true} onClose={onClose} />);

    // Page 1 should have "Next" button
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Page 2 should have "Back" and "Got it" buttons
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
  });
});
