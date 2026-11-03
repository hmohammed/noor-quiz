import { describe, expect, it } from 'vitest';
import {
  CreateSeasonRequest,
  RamadanSuggestionResponse,
  SeasonListResponse,
  SeasonView,
  SuggestRamadanQuery,
  UpdateSeasonRequest,
} from './season';

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';

const body = {
  name: 'Ramadan 1448',
  kind: 'ramadan' as const,
  startDate: '2026-02-18',
  lengthDays: 30,
  timezone: 'Europe/Stockholm',
  opensAtLocal: '08:00',
  closesAtLocal: '21:00',
};

describe('season rules', () => {
  it('accepts a real date, lengths 1 and 366, a canonical zone and 00:00', () => {
    expect(CreateSeasonRequest.parse(body)).toMatchObject(body);
    expect(
      CreateSeasonRequest.parse({
        ...body,
        lengthDays: 1,
        opensAtLocal: '00:00',
        closesAtLocal: '00:00',
      }),
    ).toMatchObject({
      lengthDays: 1,
      opensAtLocal: '00:00',
      closesAtLocal: '00:00',
    });
    expect(CreateSeasonRequest.parse({ ...body, lengthDays: 366 }).lengthDays).toBe(366);
    expect(CreateSeasonRequest.parse({ ...body, timezone: 'europe/stockholm' }).timezone).toBe(
      'Europe/Stockholm',
    );
  });

  it.each([
    ['2026-02-30', { startDate: '2026-02-30' }],
    ['2026-2-18', { startDate: '2026-2-18' }],
    ['length 0', { lengthDays: 0 }],
    ['length -1', { lengthDays: -1 }],
    ['length 1.5', { lengthDays: 1.5 }],
    ['length 367', { lengthDays: 367 }],
    ['an offset timezone', { timezone: '+01:00' }],
    ['4:00', { opensAtLocal: '4:00' }],
    ['24:00', { opensAtLocal: '24:00' }],
    ['20:00:00', { closesAtLocal: '20:00:00' }],
    ['Arabic-Indic digits', { startDate: '٢٠٢٦-٠٢-١٨' }],
    ['Arabic-Indic time', { opensAtLocal: '٠٨:٠٠' }],
    ['tenantId', { tenantId: ULID }],
    ['role', { role: 'owner' }],
    ['hijriYear', { hijriYear: 1448 }],
    ['state', { state: 'upcoming' }],
    ['createdBy', { createdBy: ULID }],
  ])('rejects %s', (_label, patch) => {
    expect(CreateSeasonRequest.safeParse({ ...body, ...patch }).success).toBe(false);
  });
});

describe('UpdateSeasonRequest', () => {
  it('accepts one field and rejects an empty body and extra keys', () => {
    expect(UpdateSeasonRequest.parse({ closesAtLocal: '22:00' })).toEqual({
      closesAtLocal: '22:00',
    });
    expect(UpdateSeasonRequest.safeParse({}).success).toBe(false);
    expect(UpdateSeasonRequest.safeParse({ startDate: '2026-02-30' }).success).toBe(false);
    expect(UpdateSeasonRequest.safeParse({ lengthDays: 1.5 }).success).toBe(false);
    expect(UpdateSeasonRequest.safeParse({ tenantId: ULID }).success).toBe(false);
    expect(UpdateSeasonRequest.safeParse({ role: 'owner' }).success).toBe(false);
    expect(UpdateSeasonRequest.safeParse({ hijriYear: 1448 }).success).toBe(false);
  });
});

describe('SuggestRamadanQuery', () => {
  it('canonicalises a zone and rejects a missing or offset zone', () => {
    expect(SuggestRamadanQuery.parse({ timezone: 'europe/stockholm' })).toEqual({
      timezone: 'Europe/Stockholm',
    });
    expect(SuggestRamadanQuery.safeParse({}).success).toBe(false);
    expect(SuggestRamadanQuery.safeParse({ timezone: '+01:00' }).success).toBe(false);
    expect(
      SuggestRamadanQuery.safeParse({ timezone: 'Europe/Stockholm', role: 'admin' }).success,
    ).toBe(false);
  });
});

describe('SeasonView', () => {
  const view = {
    id: ULID,
    tenantId: OTHER,
    ...body,
    state: { phase: 'upcoming' as const },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('accepts a view and a list, and rejects createdBy and schemaVersion', () => {
    expect(SeasonView.parse(view)).toEqual(view);
    expect(SeasonListResponse.parse({ seasons: [] })).toEqual({ seasons: [] });
    expect(SeasonListResponse.parse({ seasons: [view] }).seasons).toHaveLength(1);
    expect(SeasonView.safeParse({ ...view, createdBy: ULID }).success).toBe(false);
    expect(SeasonView.safeParse({ ...view, schemaVersion: 1 }).success).toBe(false);
    expect(
      SeasonView.safeParse({ ...view, state: { phase: 'active', dayIndex: 1, open: true } })
        .success,
    ).toBe(true);
    expect(SeasonView.safeParse({ ...view, state: { phase: 'ended' } }).success).toBe(true);
  });

  it('accepts an advisory suggestion of 29 or 30 days', () => {
    expect(
      RamadanSuggestionResponse.parse({
        hijriYear: 1448,
        startDate: '2027-02-08',
        lengthDays: 29,
        advisory: true,
      }).advisory,
    ).toBe(true);
    expect(
      RamadanSuggestionResponse.safeParse({
        hijriYear: 1448,
        startDate: '2027-02-08',
        lengthDays: 28,
        advisory: true,
      }).success,
    ).toBe(false);
    expect(
      RamadanSuggestionResponse.safeParse({
        hijriYear: 1448,
        startDate: '2027-02-08',
        lengthDays: 30,
        advisory: false,
      }).success,
    ).toBe(false);
  });
});
