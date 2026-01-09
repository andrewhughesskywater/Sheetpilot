import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValidationErrorDialog } from '@/components/timesheet/ValidationErrorDialog';

describe('ValidationErrorDialog', () => {
  it('should render when open', () => {
    const errors = [
      { row: 0, col: 0, field: 'date', message: 'Date is required' },
      { row: 1, col: 1, field: 'project', message: 'Project is required' }
    ];
    const onClose = vi.fn();

    render(
      <ValidationErrorDialog
        open={true}
        errors={errors}
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Timesheet Validation Errors \(2\)/)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const errors = [
      { row: 0, col: 0, field: 'date', message: 'Date is required' }
    ];
    const onClose = vi.fn();

    render(
      <ValidationErrorDialog
        open={false}
        errors={errors}
        onClose={onClose}
      />
    );

    expect(screen.queryByText(/Timesheet Validation Errors/)).not.toBeInTheDocument();
  });

  it('should display all errors', () => {
    const errors = [
      { row: 0, col: 0, field: 'date', message: 'Date is required' },
      { row: 1, col: 1, field: 'project', message: 'Project is required' },
      { row: 2, col: 2, field: 'taskDescription', message: 'Task description is required' }
    ];
    const onClose = vi.fn();

    render(
      <ValidationErrorDialog
        open={true}
        errors={errors}
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Row 1/)).toBeInTheDocument();
    expect(screen.getByText(/Row 2/)).toBeInTheDocument();
    expect(screen.getByText(/Row 3/)).toBeInTheDocument();
    expect(screen.getByText('Date is required')).toBeInTheDocument();
    expect(screen.getByText('Project is required')).toBeInTheDocument();
    expect(screen.getByText('Task description is required')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const errors = [
      { row: 0, col: 0, field: 'date', message: 'Date is required' }
    ];
    const onClose = vi.fn();

    render(
      <ValidationErrorDialog
        open={true}
        errors={errors}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should display error count in title', () => {
    const errors = [
      { row: 0, col: 0, field: 'date', message: 'Date is required' },
      { row: 1, col: 1, field: 'project', message: 'Project is required' }
    ];
    const onClose = vi.fn();

    render(
      <ValidationErrorDialog
        open={true}
        errors={errors}
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Timesheet Validation Errors \(2\)/)).toBeInTheDocument();
  });

  it('should handle empty errors array', () => {
    const onClose = vi.fn();

    render(
      <ValidationErrorDialog
        open={true}
        errors={[]}
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Timesheet Validation Errors \(0\)/)).toBeInTheDocument();
  });
});


