import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Archive from '../src/components/DatabaseViewer';

declare global { interface Window { database: Record<string, unknown> } }

describe('DatabaseViewer', () => {
  beforeEach(() => {
    window.database = {
      getAllTimesheetEntries: vi.fn(async () => ([
        { id: 1, date: '2025-01-15', time_in: 540, time_out: 600, hours: 1.0, project: 'P', tool: 'VS Code', detail_charge_code: 'DEV-001', task_description: 'Task' }
      ])),
      getAllCredentials: vi.fn(async () => ([
        { id: 1, service: 'smartsheet', email: 'user@test', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-02T00:00:00Z' }
      ])),
      clearDatabase: vi.fn(async () => ({ success: true }))
    };
  });

  it('renders timesheet grid with formatted values', async () => {
    render(<Archive />);
    await waitFor(() => expect(window.database.getAllTimesheetEntries).toHaveBeenCalled());
    expect(await screen.findByText('2025-01-15')).toBeInTheDocument();
    expect(await screen.findByText('01:00')).toBeInTheDocument();
    expect(await screen.findByText('P')).toBeInTheDocument();
  });
});


