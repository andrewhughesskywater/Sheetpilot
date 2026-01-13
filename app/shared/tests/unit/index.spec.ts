import { describe, it, expect } from 'vitest';

describe('shared/index', () => {
  it('should export all expected modules', async () => {
    const index = await import('../../index');
    
    // Verify main exports exist
    expect(index).toHaveProperty('APP_VERSION');
    expect(index).toHaveProperty('APP_NAME');
    expect(index).toHaveProperty('ErrorCategory');
    expect(index).toHaveProperty('AppError');
    expect(index).toHaveProperty('parseTimeToMinutes');
    expect(index).toHaveProperty('formatMinutesToTime');
  });

  it('should be importable without errors', async () => {
    await expect(async () => {
      await import('../../index');
    }).not.toThrow();
  });
});


