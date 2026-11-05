import { runQuestionRepoContract } from './contracts/question-repo.contract';
import { InMemoryQuestionRepo } from './in-memory-question-repo';

runQuestionRepoContract(async () => {
  const questions = new InMemoryQuestionRepo();
  return { questions, count: async () => questions.count() };
});
