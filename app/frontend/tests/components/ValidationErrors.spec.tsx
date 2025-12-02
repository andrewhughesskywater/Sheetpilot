import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValidationErrors } from '../../src/components/timesheet/ValidationErrors';

describe('ValidationErrors', () => {
  it('should return null when no errors', () => {
    const onShowAllErrors = vi.fn();
    const { container } = render(
      <ValidationErrors errors={[]} onShowAllErrors={onShowAllErrors} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should display individual errors when 3 or fewer', () => {
    const errors = [
      { row: 0, col: 0, field: 'date', message: 'Date is required' },
      { row: 1, col: 1, field: 'project', message: 'Project is required' }
    ];
    const onShowAllErrors = vi.fn();

    render(
      <ValidationErrors errors={errors} onShowAllErrors={onShowAllErrors} />
    );

    expect(screen.getByText(/Row 1: Date is required/)).toBeInTheDocument();
    expect(screen.getByText(/Row 2: Project is required/)).toBeInTheDocument();
  });

  it('should display summary when more than 3 errors', () => {
    const errors = [
      { row: 0, col: 0, field: 'date', message: 'Date is required' },
      { row: 1, col: 1, field: 'project', message: 'Project is required' },
      { row: 2, col: 2, field: 'taskDescription', message: 'Task description is required' },
      { row: 3, col: 0, field: 'timeIn', message: 'Time In is required' },
      { row: 4, col: 1, field: 'timeOut', message: 'Time Out is required' }
    ];
    const onShowAllErrors = vi.fn();

    render(
      <ValidationErrors errors={errors} onShowAllErrors={onShowAllErrors} />
    );

    expect(screen.getByText(/Multiple validation errors found/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Error count chip
    expect(screen.getByRole('button', { name: /View All/i })).toBeInTheDocument();
  });

  it('should call onShowAllErrors when View All button is clicked', async () => {
    const user = userEvent.setup();
    const errors = [
      { row: 0, col: 0, field: 'date', message: 'Date is required' },
      { row: 1, col: 1, field: 'project', message: 'Project is required' },
      { row: 2, col: 2, field: 'taskDescription', message: 'Task description is required' },
      { row: 3, col: 0, field: 'timeIn', message: 'Time In is required' }
    ];
    const onShowAllErrors = vi.fn();

    render(
      <ValidationErrors errors={errors} onShowAllErrors={onShowAllErrors} />
    );

    const viewAllButton = screen.getByRole('button', { name: /View All/i });
    await user.click(viewAllButton);

    expect(onShowAllErrors).toHaveBeenCalledTimes(1);
  });

  it('should display exactly 3 errors when showing individual errors', () => {
    const errors = [
      { row: 0, col: 0, field: 'date', message: 'Date is required' },
      { row: 1, col: 1, field: 'project', message: 'Project is required' },
      { row: 2, col: 2, field: 'taskDescription', message: 'Task description is required' }
    ];
    const onShowAllErrors = vi.fn();

    render(
      <ValidationErrors errors={errors} onShowAllErrors={onShowAllErrors} />
    );

    expect(screen.getByText(/Row 1: Date is required/)).toBeInTheDocument();
    expect(screen.getByText(/Row 2: Project is required/)).toBeInTheDocument();
    expect(screen.getByText(/Row 3: Task description is required/)).toBeInTheDocument();
    expect(screen.queryByText(/View All/i)).not.toBeInTheDocument();
  });
});


