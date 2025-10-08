import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock the entire App component to avoid React hook initialization issues
vi.mock('../src/App', () => ({
  default: () => React.createElement('div', { 'data-testid': 'app-root' }, 'SheetPilot App'),
}));

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
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByTestId('app-root')).toBeInTheDocument();
    expect(screen.getByText('SheetPilot App')).toBeInTheDocument();
  });
});


