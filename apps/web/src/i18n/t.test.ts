import { describe, expect, it } from 'vitest';
import { t } from './t';

describe('t', () => {
  it("returns 'API ok' for home.api.ok", () => {
    expect(t('home.api.ok')).toBe('API ok');
  });

  it('returns the key itself for an unknown key', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
