import '@testing-library/jest-dom';

// Mock Tauri API
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// Export mock for tests to use
export { mockInvoke };

