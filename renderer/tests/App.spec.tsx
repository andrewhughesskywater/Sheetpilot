import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from '../src/App';

declare global { 
  interface Window { 
    timesheet: Record<string, unknown>; 
    excel: Record<string, unknown>; 
    credentials: Record<string, unknown>; 
    database: Record<string, unknown>; 
  } 
}

describe('App renderer', () => {
  beforeEach(() => {
    window.timesheet = {
      import: vi.fn(async () => ({ inserted: 2, sheet: 'Timesheet', dbPath: 'C:/db.sqlite', duplicates: 0, total: 2 })),
      automate: vi.fn(async () => ({
        importResult: { inserted: 2, sheet: 'Timesheet', duplicates: 0, total: 2 },
        submitResult: { ok: true, successCount: 1, removedCount: 0, totalProcessed: 1 },
        dbPath: 'C:/db.sqlite'
      }))
    };
    window.excel = { open: vi.fn(async () => ({ canceled: false, filePath: 'C:/file.xlsx' })) };
    window.credentials = {
      store: vi.fn(async () => ({ success: true, message: 'Credentials stored successfully', changes: 1 })),
      list: vi.fn(async () => ([])),
      delete: vi.fn(async () => ({ success: true, message: 'Credentials deleted successfully', changes: 1 }))
    };
    window.database = {
      getAllTimesheetEntries: vi.fn(async () => []),
      getAllCredentials: vi.fn(async () => []),
      clearDatabase: vi.fn(async () => ({ success: true }))
    };
  });

  it('renders and runs automation flow', async () => {
    render(<App />);
    const startBtn = await screen.findByRole('button', { name: /start automation/i });
    fireEvent.click(startBtn);
    await waitFor(() => expect(window.timesheet.automate).toHaveBeenCalled());
    const status = await screen.findByText(/Submitted 1\/1 entries/i);
    expect(status).toBeInTheDocument();
  });

  it('imports only and shows inserted rows', async () => {
    render(<App />);
    const importBtn = await screen.findByRole('button', { name: /import only/i });
    fireEvent.click(importBtn);
    await waitFor(() => expect(window.timesheet.import).toHaveBeenCalled());
    expect(await screen.findByText(/Inserted 2 rows/)).toBeInTheDocument();
  });

  it('opens Excel file and updates status', async () => {
    render(<App />);
    const openBtn = await screen.findByRole('button', { name: /open excel file/i });
    fireEvent.click(openBtn);
    await waitFor(() => expect(window.excel.open).toHaveBeenCalled());
    expect(await screen.findByText(/Opened Excel file:/i)).toBeInTheDocument();
  });

  it('saves credentials via dialog', async () => {
    render(<App />);
    const addCreds = await screen.findByRole('button', { name: /add credentials/i });
    fireEvent.click(addCreds);

    const emailInput = await screen.findByLabelText(/email/i);
    const passwordInput = await screen.findByLabelText(/password/i);
    fireEvent.change(emailInput, { target: { value: 'user@test' } });
    fireEvent.change(passwordInput, { target: { value: 'pw' } });

    const saveBtn = await screen.findByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(window.credentials.store).toHaveBeenCalled());
    expect(await screen.findByText(/Credentials stored successfully/i)).toBeInTheDocument();
  });

  it('loads Archive tab data, refreshes, and clears archive', async () => {
    render(<App />);

    const archiveTab = await screen.findByRole('tab', { name: /archive/i });
    archiveTab.click();

    await waitFor(() => expect(window.database.getAllTimesheetEntries).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.database.getAllCredentials).toHaveBeenCalledTimes(1));

    const refreshBtn = await screen.findByRole('button', { name: /refresh/i });
    refreshBtn.click();
    await waitFor(() => expect(window.database.getAllTimesheetEntries).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(window.database.getAllCredentials).toHaveBeenCalledTimes(2));

    const clearBtn = await screen.findByRole('button', { name: /clear archive \(dev only\)/i });
    // Confirm dialog is invoked via window.confirm; stub it to accept
    const origConfirm = window.confirm;
    // @ts-expect-error - Mocking window.confirm for test
    window.confirm = () => true;
    clearBtn.click();
    await waitFor(() => expect(window.database.clearDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.database.getAllTimesheetEntries).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(window.database.getAllCredentials).toHaveBeenCalledTimes(3));
    window.confirm = origConfirm;
  });
});


