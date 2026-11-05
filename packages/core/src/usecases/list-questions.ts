import { asTenantId } from '../communities/community';
import type { QuestionRepo } from '../ports/repos';
import type { Question } from '../questions/question';

function byNewest(a: Question, b: Question): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

/** This tenant's questions, newest `createdAt` first, then `id`. */
export async function listQuestions(
  deps: { questions: QuestionRepo },
  input: { tenantId: string },
): Promise<Question[]> {
  const tenantId = asTenantId(input.tenantId);
  const questions = await deps.questions.list(tenantId);
  return questions.slice().sort(byNewest);
}
