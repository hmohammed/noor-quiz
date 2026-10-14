import { describe, expect, it } from 'vitest';
import { SystemClock } from './clock';

describe('SystemClock', () => {
  it('returns an Instant between two Date.now() readings', () => {
    const clock = new SystemClock();
    const before = Date.now();
    const now = clock.now();
    const after = Date.now();

    expect(Number.isInteger(now)).toBe(true);
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});
