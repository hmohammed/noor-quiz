import { runSeasonRepoContract } from './contracts/season-repo.contract';
import { InMemorySeasonRepo } from './in-memory-season-repo';

runSeasonRepoContract('InMemorySeasonRepo', async () => {
  const seasons = new InMemorySeasonRepo();
  return { seasons, count: async () => seasons.count() };
});
