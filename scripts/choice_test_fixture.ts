import assert from "node:assert/strict";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { choiceSchema, choiceStepId, makeChoiceSnapshots } from "../lib/practiceChoice";
export const prisma = new PrismaClient();
export const baseUrl = process.env.CHOICE_TEST_BASE_URL ?? process.env.PROGRESS_TEST_BASE_URL ??
  process.env.SESSION_TEST_BASE_URL ?? process.env.OFFLINE_TEST_BASE_URL ?? "http://127.0.0.1:3100";
export async function api(path: string, cookie = "", method = "GET", body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { cookie, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
  return { status: response.status, data: await response.json(), response };
}
export function testChoice(id: string, multiple = false, skillId?: string, sum = 7) {
  const addition = sum === 2 ? "1+1" : "3+4";
  return choiceSchema.parse({ version: 1, type: multiple ? "multiple" : "single",
    questionText: multiple ? "Выберите все корни $x^2=4$." : `Вычислите $${addition}$.`,
    questionTextKk: multiple ? "$x^2=4$ теңдеуінің барлық түбірін таңдаңыз." : `$${addition}$ мәнін есептеңіз.`, latex: null,
    options: (multiple ? ["-2", "2", "4", "-4", "0"] : sum === 2 ? ["2","0","1","-2","4"] : ["7", "1", "12", "-1", "6"]).map((text,i) => ({ id: `${id}-${i}`, text, textKk: text,
      ...(skillId && i === 1 && !multiple ? { misconception: { errorType: "incorrect_method", skillId,
        ru: "Выполнено вычитание вместо сложения.", kk: "Қосудың орнына азайту орындалды." } } : {}) })),
    correctOptionIds: multiple ? [`${id}-0`, `${id}-1`] : [`${id}-0`], explanation: multiple ? "Два корня: −2 и 2." : `${addition}=${sum}.`,
    explanationKk: multiple ? "Екі түбір: −2 және 2." : `${addition}=${sum}.`, skillIds: skillId ? [skillId] : [],
    solutionSteps: [{ prompt: "Проверьте вычисление", promptKk: "Есептеуді тексеріңіз", answer: multiple ? "(-2)^2=2^2=4" : `${addition}=${sum}` }],
    hint: { ru: "Определите нужную операцию.", kk: "Қажетті амалды анықтаңыз." },
  });
}
export async function choiceFixture() {
  // Check availability before writing any fixture rows.
  assert.equal((await api("/api/auth/me")).status, 401);
  const run = `choice-test-${randomUUID()}`, users: string[] = [];
  const topic = await prisma.topic.create({ data: { id: run, name: run, nameKk: run, description: run, order: 9999 } });
  const skill = await prisma.skill.create({ data: { id: `${run}-skill`, topicId: topic.id, nameRu: "Проверка операции", nameKk: "Амалды тексеру",
    explanationRu: "Операции", explanationKk: "Амалдар", ruleRu: "Проверьте операцию", ruleKk: "Амалды тексеріңіз" } });
  for (let i = 0; i < 24; i++) {
    const id = `${run}-q-${String(i).padStart(2,"0")}`, multiple = i >= 21;
    await prisma.question.create({ data: { id, topicId: topic.id, title: "Тест выбора", titleKk: "Таңдау тесті",
      questionText: "Вычислите 3+4", questionTextKk: "3+4 мәнін есептеңіз", correctAnswer: "7", answerType: "number",
      explanation: "3+4=7", explanationKk: "3+4=7", skills: { create: { skillId: skill.id } },
      practiceChoice: testChoice(id, multiple, skill.id) as unknown as Prisma.InputJsonValue,
      steps: { create: { order: 1, type: "numeric_input", prompt: "Старый шаг", promptKk: "Ескі қадам", expectedAnswer: "7", hint: "Legacy hint",
        skills: { create: { skillId: skill.id } } } } } });
  }
  async function register(label: string) {
    const email = `${run}-${label}@example.test`;
    const result = await api("/api/auth/register", "", "POST", { name: label, email, password: "choice-password-123" });
    assert.equal(result.status, 200, JSON.stringify(result.data)); users.push(result.data.user.id);
    return { id: result.data.user.id as string, email, cookie: result.response.headers.get("set-cookie")!.split(";")[0] };
  }
  const a = await register("A"), b = await register("B");
  async function session(userId: string, questionIds: string[]) {
    return prisma.$transaction(async tx => tx.practiceSession.create({ data: { userId, mode: "mixed", questionIds,
      totalCount: questionIds.length, choiceSnapshots: await makeChoiceSnapshots(tx, questionIds) } }));
  }
  return { run, topic, skill, a, b, session, q: (i: number) => `${run}-q-${String(i).padStart(2,"0")}`,
    async cleanup() {
      const where = { userId: { in: users } };
      await prisma.learningCheck.deleteMany({ where }); await prisma.skillReview.deleteMany({ where });
      await prisma.mistake.deleteMany({ where }); await prisma.skillObservation.deleteMany({ where });
      await prisma.userStepAnswer.deleteMany({ where: { attempt: where } }); await prisma.userAttempt.deleteMany({ where });
      await prisma.practiceSession.deleteMany({ where }); await prisma.userTopicProgress.deleteMany({ where });
      await prisma.dailyGoal.deleteMany({ where }); await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.questionStep.deleteMany({ where: { question: { topicId: topic.id } } });
      await prisma.question.deleteMany({ where: { topicId: topic.id } }); await prisma.skill.deleteMany({ where: { topicId: topic.id } });
      await prisma.topic.delete({ where: { id: topic.id } });
    } };
}
export function submission(sessionId: string, questionId: string, answer: string, submissionId = randomUUID()) {
  return { sessionId, questionId, submissionId, timeSpent: 3, usedHint: false, stepAnswers: [{ stepId: choiceStepId(questionId), answer }] };
}
export function noKeys(value: unknown) {
  for (const field of ["practiceChoice", "choiceSnapshots", "correctOptionIds", "correctAnswer", "expectedAnswer", "isCorrect", "explanation", "solutionSteps", "misconception", "localKey"]) {
    assert.ok(!JSON.stringify(value).includes(`"${field}"`), field);
  }
}
