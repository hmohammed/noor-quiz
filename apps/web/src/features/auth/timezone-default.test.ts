import { describe, expect, it } from 'vitest';
import { timezoneDefault } from './timezone-default';

describe('timezoneDefault', () => {
  it('returns the browser zone when the user has none', () => {
    expect(timezoneDefault({ timezone: null }, 'Africa/Addis_Ababa')).toEqual({
      timezone: 'Africa/Addis_Ababa',
    });
  });

  it('returns null when the user already has a timezone', () => {
    expect(timezoneDefault({ timezone: 'Europe/Stockholm' }, 'Africa/Addis_Ababa')).toBeNull();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty', ''],
    ['unknown', 'Mars/Olympus'],
    ['an offset', '+01:00'],
  ])('returns null when the browser zone is %s', (_label, tz) => {
    expect(timezoneDefault({ timezone: null }, tz)).toBeNull();
  });
});
