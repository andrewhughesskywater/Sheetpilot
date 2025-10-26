import { describe, it, expect } from 'vitest';

describe('Test Setup Verification', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to DOM environment', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });

  it('should be able to create DOM elements', () => {
    const div = document.createElement('div');
    div.textContent = 'Test';
    expect(div.textContent).toBe('Test');
  });
});
