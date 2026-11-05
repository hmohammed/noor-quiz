import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  createQuestion,
  DomainError,
  listQuestions,
  updateQuestion,
  type Question as StoredQuestion,
} from '@noor/core';
import {
  CreateQuestionRequest,
  Question,
  QuestionListResponse,
  UpdateQuestionRequest,
  type Question as QuestionBody,
} from '@noor/contracts';
import type { AppEnv } from '../app-env';
import { parseJsonBody } from '../http/parse-json-body';
import { requireConsent } from '../middleware/require-consent';
import { requireMember } from '../middleware/require-member';
import { requireUser } from '../middleware/require-user';

/** Five locales fit. The season cap of 4096 does not. */
const MAX_BODY_BYTES = 32768;

function limitBody() {
  return bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: () => {
      throw new DomainError('VALIDATION', { reason: 'body-too-large' });
    },
  });
}

/** Named fields only, so `schemaVersion` stays server-side. The editor view keeps `answer`. */
function questionView(question: StoredQuestion): QuestionBody {
  return Question.parse({
    id: question.id,
    tenantId: question.tenantId,
    type: question.type,
    difficulty: question.difficulty,
    topic: question.topic,
    locales: question.locales,
    answer: question.answer,
    sources: question.sources,
    reviewStatus: question.reviewStatus,
    reviewNotes: question.reviewNotes,
    authoredBy: question.authoredBy,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  });
}

/** Draft, list and patch a community's multiple-choice questions. Editor or above. */
export function questionsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .post(
      '/v1/t/:tenantId/questions',
      limitBody(),
      requireUser(),
      requireConsent(),
      requireMember('editor'),
      async (c) => {
        const body = await parseJsonBody(c, CreateQuestionRequest);
        const question = await createQuestion(c.var.deps, {
          tenantId: c.var.membership.tenantId,
          userId: c.var.membership.userId,
          ...body,
        });
        return c.json(questionView(question), 201);
      },
    )
    .get(
      '/v1/t/:tenantId/questions',
      requireUser(),
      requireConsent(),
      requireMember('editor'),
      async (c) => {
        const questions = await listQuestions(c.var.deps, {
          tenantId: c.var.membership.tenantId,
        });
        return c.json(QuestionListResponse.parse({ questions: questions.map(questionView) }), 200);
      },
    )
    .patch(
      '/v1/t/:tenantId/questions/:questionId',
      limitBody(),
      requireUser(),
      requireConsent(),
      requireMember('editor'),
      async (c) => {
        const body = await parseJsonBody(c, UpdateQuestionRequest);
        const question = await updateQuestion(c.var.deps, {
          tenantId: c.var.membership.tenantId,
          questionId: c.req.param('questionId'),
          patch: body,
        });
        return c.json(questionView(question), 200);
      },
    );
}
