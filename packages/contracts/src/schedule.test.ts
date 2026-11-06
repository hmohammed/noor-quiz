import { describe, expect, it } from 'vitest';
import { ScheduleEntry, ScheduleQuestionRequest } from './schedule';

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const AT = '2026-11-06T12:05:00.000Z';

describe('ScheduleQuestionRequest', () => {
  it('accepts a ULID questionId and rejects extras or a bad id', () => {
    expect(ScheduleQuestionRequest.parse({ questionId: ULID })).toEqual({ questionId: ULID });
    expect(ScheduleQuestionRequest.safeParse({ questionId: 'nope' }).success).toBe(false);
    expect(ScheduleQuestionRequest.safeParse({ questionId: ULID, extra: true }).success).toBe(
      false,
    );
    expect(ScheduleQuestionRequest.safeParse({}).success).toBe(false);
  });
});

describe('ScheduleEntry', () => {
  it('accepts a day mapping and rejects schemaVersion or a dayIndex out of range', () => {
    const entry = {
      id: `${ULID}_3`,
      tenantId: OTHER,
      seasonId: ULID,
      questionId: OTHER,
      dayIndex: 3,
      scheduledBy: ULID,
      scheduledAt: AT,
    };
    expect(ScheduleEntry.parse(entry)).toEqual(entry);
    expect(ScheduleEntry.safeParse({ ...entry, schemaVersion: 1 }).success).toBe(false);
    expect(ScheduleEntry.safeParse({ ...entry, dayIndex: 0 }).success).toBe(false);
    expect(ScheduleEntry.safeParse({ ...entry, dayIndex: 367 }).success).toBe(false);
  });
});
