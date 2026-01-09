import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { DataProvider, useData } from '@/contexts/DataContext';
import { useSession } from '@/contexts/SessionContext';
import * as timesheetService from '@/services/ipc/timesheet';
import * as credentialsService from '@/services/ipc/credentials';

// Mock dependencies
vi.mock('@/contexts/SessionContext', () => ({
  useSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock('@/services/ipc/timesheet', () => ({
  loadDraft: vi.fn()
}));

vi.mock('@/services/ipc/credentials', () => ({
  getAllArchiveData: vi.fn()
}));

describe('DataContext - Archive Loading State Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      isLoggedIn: true,
      isLoading: false,
      token: 'test-token',
      username: 'testuser',
      login: vi.fn(),
      logout: vi.fn()
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DataProvider>{children}</DataProvider>
  );

  describe('Loading state reset after successful load', () => {
    it('should set isArchiveDataLoading to false after successful data load', async () => {
      vi.mocked(credentialsService.getAllArchiveData).mockResolvedValue({
        success: true,
        timesheet: [{ id: 1, date: '2024-01-01', hours: 8 }],
        credentials: [{ id: 1, name: 'Test' }]
      } as any);

      const { result } = renderHook(() => useData(), { wrapper });

      // Call refresh to trigger the load
      await act(async () => {
        await result.current.refreshArchiveData();
      });

      // After successful load, loading state should be false
      await waitFor(() => {
        expect(result.current.isArchiveDataLoading).toBe(false);
      });
    });

    it('should set isArchiveDataLoading to false on error', async () => {
      vi.mocked(credentialsService.getAllArchiveData).mockRejectedValue(
        new Error('API error')
      );

      const { result } = renderHook(() => useData(), { wrapper });

      // Call refresh to trigger the load
      await act(async () => {
        await result.current.refreshArchiveData();
      });

      // Even on error, loading state should be false
      await waitFor(() => {
        expect(result.current.isArchiveDataLoading).toBe(false);
      });
    });

    it('should set isArchiveDataLoading to false when no token available', async () => {
      vi.mocked(useSession).mockReturnValue({
        isLoggedIn: false,
        isLoading: false,
        token: null,
        username: null,
        login: vi.fn(),
        logout: vi.fn()
      } as any);

      const { result } = renderHook(() => useData(), { wrapper });

      // Call refresh to trigger the load
      await act(async () => {
        await result.current.refreshArchiveData();
      });

      // Loading state should be false even when no token
      await waitFor(() => {
        expect(result.current.isArchiveDataLoading).toBe(false);
      });
    });

    it('should handle unsuccessful API response and set loading to false', async () => {
      vi.mocked(credentialsService.getAllArchiveData).mockResolvedValue({
        success: false,
        error: 'Access denied',
        timesheet: [],
        credentials: []
      } as any);

      const { result } = renderHook(() => useData(), { wrapper });

      await act(async () => {
        await result.current.refreshArchiveData();
      });

      // Loading state should be false even on unsuccessful response
      await waitFor(() => {
        expect(result.current.isArchiveDataLoading).toBe(false);
        expect(result.current.archiveDataError).toBeTruthy();
      });
    });
  });

  describe('Loading state reset after successful timesheet load', () => {
    it('should set isTimesheetDraftLoading to false after successful data load', async () => {
      vi.mocked(timesheetService.loadDraft).mockResolvedValue({
        success: true,
        entries: [{ id: 1, date: '2024-01-01', hours: 8 }]
      } as any);

      const { result } = renderHook(() => useData(), { wrapper });

      // Call refresh to trigger the load
      await act(async () => {
        await result.current.refreshTimesheetDraft();
      });

      // After successful load, loading state should be false
      await waitFor(() => {
        expect(result.current.isTimesheetDraftLoading).toBe(false);
      });
    });

    it('should set isTimesheetDraftLoading to false on error', async () => {
      vi.mocked(timesheetService.loadDraft).mockRejectedValue(
        new Error('API error')
      );

      const { result } = renderHook(() => useData(), { wrapper });

      // Call refresh to trigger the load
      await act(async () => {
        await result.current.refreshTimesheetDraft();
      });

      // Even on error, loading state should be false
      await waitFor(() => {
        expect(result.current.isTimesheetDraftLoading).toBe(false);
      });
    });
  });
});
