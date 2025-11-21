import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { sessionStore } from './sessionStore';
import { mockInvoke } from '../tests/setup';

describe('Session Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    sessionStore.set({
      isAuthenticated: false,
      username: null,
      sessionId: null,
    });
  });

  it('should have initial unauthenticated state', () => {
    const state = get(sessionStore);
    expect(state.isAuthenticated).toBe(false);
    expect(state.username).toBe(null);
    expect(state.sessionId).toBe(null);
  });

  it('should update state after successful login', async () => {
    mockInvoke.mockResolvedValueOnce({
      success: true,
      sessionId: 'test-session-123',
      username: 'testuser',
    });

    // Simulate login
    sessionStore.set({
      isAuthenticated: true,
      username: 'testuser',
      sessionId: 'test-session-123',
    });

    const state = get(sessionStore);
    expect(state.isAuthenticated).toBe(true);
    expect(state.username).toBe('testuser');
    expect(state.sessionId).toBe('test-session-123');
  });

  it('should clear state after logout', () => {
    // Set authenticated state
    sessionStore.set({
      isAuthenticated: true,
      username: 'testuser',
      sessionId: 'test-session-123',
    });

    // Logout
    sessionStore.set({
      isAuthenticated: false,
      username: null,
      sessionId: null,
    });

    const state = get(sessionStore);
    expect(state.isAuthenticated).toBe(false);
    expect(state.username).toBe(null);
    expect(state.sessionId).toBe(null);
  });
});

