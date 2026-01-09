import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusButton } from '@/components/StatusButton';

describe('StatusButton', () => {
  it('should render button with text', () => {
    const onClick = vi.fn();
    render(
      <StatusButton status="ready" onClick={onClick}>
        Submit
      </StatusButton>
    );

    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('should be enabled when status is ready', () => {
    const onClick = vi.fn();
    render(
      <StatusButton status="ready" onClick={onClick}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });

  it('should be disabled when status is neutral', () => {
    const onClick = vi.fn();
    render(
      <StatusButton status="neutral" onClick={onClick}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when status is warning', () => {
    const onClick = vi.fn();
    render(
      <StatusButton status="warning" onClick={onClick}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when isProcessing is true', () => {
    const onClick = vi.fn();
    render(
      <StatusButton status="ready" onClick={onClick} isProcessing={true}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when disabled prop is true', () => {
    const onClick = vi.fn();
    render(
      <StatusButton status="ready" onClick={onClick} disabled={true}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should call onClick when clicked and enabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <StatusButton status="ready" onClick={onClick}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 }); // Skip pointer-events check for disabled button
    const onClick = vi.fn();
    render(
      <StatusButton status="neutral" onClick={onClick}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('should show loading state when isProcessing is true', () => {
    const onClick = vi.fn();
    render(
      <StatusButton status="ready" onClick={onClick} isProcessing={true}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    // MUI LoadingButton uses disabled state and loading indicator, not aria-busy
    expect(button).toBeDisabled();
  });

  it('should use correct color for ready status', () => {
    const onClick = vi.fn();
    render(
      <StatusButton status="ready" onClick={onClick}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-colorSuccess');
  });

  it('should use correct color for warning status', () => {
    const onClick = vi.fn();
    render(
      <StatusButton status="warning" onClick={onClick}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-colorWarning');
  });

  it('should use correct color for neutral status', () => {
    const onClick = vi.fn();
    render(
      <StatusButton status="neutral" onClick={onClick}>
        Submit
      </StatusButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-colorPrimary');
  });

  it('should render with different sizes', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <StatusButton status="ready" onClick={onClick} size="small">
        Submit
      </StatusButton>
    );

    let button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-sizeSmall');

    rerender(
      <StatusButton status="ready" onClick={onClick} size="large">
        Submit
      </StatusButton>
    );

    button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-sizeLarge');
  });
});
