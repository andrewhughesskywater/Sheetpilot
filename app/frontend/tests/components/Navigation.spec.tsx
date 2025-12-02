import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navigation from '../../src/components/Navigation';

describe('Navigation', () => {
  it('should render all tabs', () => {
    const onTabChange = vi.fn();
    render(<Navigation activeTab={0} onTabChange={onTabChange} />);

    expect(screen.getByText('Timesheet')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should set active tab correctly', () => {
    const onTabChange = vi.fn();
    const { rerender } = render(<Navigation activeTab={0} onTabChange={onTabChange} />);

    const timesheetTab = screen.getByRole('tab', { name: /timesheet/i });
    expect(timesheetTab).toHaveAttribute('aria-selected', 'true');

    rerender(<Navigation activeTab={1} onTabChange={onTabChange} />);
    const archiveTab = screen.getByRole('tab', { name: /archive/i });
    expect(archiveTab).toHaveAttribute('aria-selected', 'true');
  });

  it('should call onTabChange when tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<Navigation activeTab={0} onTabChange={onTabChange} />);

    const archiveTab = screen.getByRole('tab', { name: /archive/i });
    await user.click(archiveTab);

    expect(onTabChange).toHaveBeenCalledWith(1);
  });

  it('should have correct aria attributes', () => {
    const onTabChange = vi.fn();
    render(<Navigation activeTab={0} onTabChange={onTabChange} />);

    expect(screen.getByRole('tab', { name: /timesheet/i })).toHaveAttribute('id', 'nav-tab-0');
    expect(screen.getByRole('tab', { name: /timesheet/i })).toHaveAttribute('aria-controls', 'nav-tabpanel-0');
    expect(screen.getByRole('tab', { name: /archive/i })).toHaveAttribute('id', 'nav-tab-1');
    expect(screen.getByRole('tab', { name: /archive/i })).toHaveAttribute('aria-controls', 'nav-tabpanel-1');
    expect(screen.getByRole('tab', { name: /settings/i })).toHaveAttribute('id', 'nav-tab-2');
    expect(screen.getByRole('tab', { name: /settings/i })).toHaveAttribute('aria-controls', 'nav-tabpanel-2');
  });

  it('should have aria-label on tabs container', () => {
    const onTabChange = vi.fn();
    render(<Navigation activeTab={0} onTabChange={onTabChange} />);

    const tabs = screen.getByRole('tablist');
    expect(tabs).toHaveAttribute('aria-label', 'navigation tabs');
  });
});


