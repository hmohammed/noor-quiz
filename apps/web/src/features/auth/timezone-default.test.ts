import { describe, expect, it } from 'vitest';
import { timezoneDefault } from './timezone-default';

const GIVEN = { currentVersion: '2026-11-01', acceptedVersion: '2026-11-01', required: false };
const REQUIRED = { currentVersion: '2026-11-01', acceptedVersion: null, required: true };

describe('timezoneDefault', () => {
  it('returns the browser zone when the user has none', () => {
    expect(timezoneDefault({ timezone: null, consent: GIVEN }, 'Africa/Addis_Ababa')).toEqual({
      timezone: 'Africa/Addis_Ababa',
    });
  });

  it('returns null while consent is required, even with no timezone and a valid browser zone', () => {
    expect(timezoneDefault({ timezone: null, consent: REQUIRED }, 'Africa/Addis_Ababa')).toBeNull();
  });

  it('returns null when the user already has a timezone', () => {
    expect(
      timezoneDefault({ timezone: 'Europe/Stockholm', consent: GIVEN }, 'Africa/Addis_Ababa'),
    ).toBeNull();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty', ''],
    ['unknown', 'Mars/Olympus'],
    ['an offset', '+01:00'],
  ])('returns null when the browser zone is %s', (_label, tz) => {
    expect(timezoneDefault({ timezone: null, consent: GIVEN }, tz)).toBeNull();
  });
});
