import { describe, expect, it } from 'vitest';
import { InMemoryScheduleRepo } from './in-memory-schedule-repo';
import { runScheduleRepoContract } from './contracts/schedule-repo.contract';

runScheduleRepoContract(async () => {
  const schedules = new InMemoryScheduleRepo();
  return { schedules, count: async () => schedules.count() };
});

describe('InMemoryScheduleRepo', () => {
  it('starts empty', () => {
    expect(new InMemoryScheduleRepo().count()).toBe(0);
  });
});
