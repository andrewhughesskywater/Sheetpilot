import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock ResizeObserver immediately (must be before any code that uses it)
const ResizeObserverMock = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock Vite environment variables
vi.stubGlobal('import', {
  meta: {
    env: {
      DEV: true,
      PROD: false,
      MODE: 'development'
    }
  }
});

// Mock window.matchMedia
Object.defineProperty(globalThis.window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)' ? false : false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});



// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock requestIdleCallback
global.requestIdleCallback = vi.fn().mockImplementation((callback) => {
  setTimeout(callback, 0);
  return 1;
});

global.cancelIdleCallback = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(globalThis.window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(globalThis.window, 'sessionStorage', {
  value: sessionStorageMock
});

// Global test setup
beforeAll(() => {
  // Suppress console warnings during tests
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || 
       args[0].includes('React DevTools') ||
       args[0].includes('Material-UI'))
    ) {
      return;
    }
    originalWarn(...args);
  };
  
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || 
       args[0].includes('React DevTools') ||
       args[0].includes('Material-UI'))
    ) {
      return;
    }
    originalError(...args);
  };
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Re-install ResizeObserver mock (in case it was cleaned up)
  if (!global.ResizeObserver) {
    global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  }
  
  // Reset localStorage and sessionStorage
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
  
  // Clear window object extensions
  if (typeof globalThis.window !== 'undefined') {
    const win = globalThis.window as unknown as Record<string, unknown>;
    delete win['logger'];
    delete win['timesheet'];
    delete win['credentials'];
    delete win['database'];
    delete win['logs'];
    delete win['api'];
  }
});

afterEach(() => {
  // Clean up after each test
  vi.clearAllMocks();
});
