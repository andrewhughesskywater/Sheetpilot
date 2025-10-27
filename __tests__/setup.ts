/**
 * Vitest setup file
 * This file runs before all tests to configure the test environment
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock ResizeObserver immediately (must be before any code that uses it)
const ResizeObserverMock = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

global.ResizeObserver = ResizeObserverMock;
window.ResizeObserver = ResizeObserverMock;

// Mock other browser APIs that might be missing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
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

// Mock Handsontable to prevent it from interfering with React
vi.mock('@handsontable/react-wrapper', () => ({
  HotTable: vi.fn(() => null),
  registerAllModules: vi.fn(),
}));

vi.mock('handsontable/registry', () => ({
  registerAllModules: vi.fn(),
}));

// Mock main Handsontable export
vi.mock('handsontable', () => ({
  default: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    render: vi.fn(),
    updateSettings: vi.fn(),
    getData: vi.fn(() => []),
    setData: vi.fn(),
    getCell: vi.fn(),
    setCellMeta: vi.fn(),
    getCellMeta: vi.fn(),
    addHook: vi.fn(),
    removeHook: vi.fn(),
    runHooks: vi.fn(),
    isDestroyed: vi.fn(() => false),
  })),
}));

vi.mock('handsontable/base', () => ({
  Core: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    render: vi.fn(),
    updateSettings: vi.fn(),
    getData: vi.fn(() => []),
    setData: vi.fn(),
    getCell: vi.fn(),
    setCellMeta: vi.fn(),
    getCellMeta: vi.fn(),
    addHook: vi.fn(),
    removeHook: vi.fn(),
    runHooks: vi.fn(),
    isDestroyed: vi.fn(() => false),
  })),
}));


// Mock Playwright to prevent browser automation in tests
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve({
      newPage: vi.fn(() => Promise.resolve({
        goto: vi.fn(),
        fill: vi.fn(),
        click: vi.fn(),
        waitForSelector: vi.fn(),
        close: vi.fn(),
        url: vi.fn(() => 'http://localhost'),
        evaluate: vi.fn(() => Promise.resolve({})),
        on: vi.fn(),
        off: vi.fn()
      })),
      close: vi.fn()
    }))
  }
}));

// Clean up after each test to prevent memory leaks and test interference
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

