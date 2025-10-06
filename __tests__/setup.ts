/**
 * Vitest setup file
 * This file runs before all tests to configure the test environment
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Handsontable to prevent it from interfering with React
vi.mock('@handsontable/react-wrapper', () => ({
  HotTable: vi.fn(() => null),
  registerAllModules: vi.fn(),
}));

vi.mock('handsontable/registry', () => ({
  registerAllModules: vi.fn(),
}));

// Clean up after each test to prevent memory leaks and test interference
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

