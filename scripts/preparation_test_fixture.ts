import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { choiceFixture, api, prisma, testChoice } from "./choice_test_fixture";
import { lockAccount } from "../lib/practiceStorage";
import { createProgramCycle } from "../lib/learning-road/program-data";
import type { PaperQuestion } from "../lib/exam/mode";
import type { PreparationView } from "../lib/learning-road/program";

export function requireTestDatabase() {
  assert.match(new URL(process.env.DATABASE_URL ?? "").pathname, /test/i, "Use an explicitly isolated test database");
}
export async function preparation(cookie: string): Promise<PreparationView> {
  const result = await api("/api/preparation", cookie); assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data;
}
export async function finishDiagnostic(cookie: string, wrong = false) {
  let state = (await api("/api/diagnostics", cookie, "POST", {})).data;
  assert.ok(state.id);
  while (state.status === "active") {
    const saved = await prisma.diagnosticSession.findUniqueOrThrow({ where: { id: state.id } });
    const q = (saved.questionSnapshots as Record<string, any>)[state.question.id] ?? await prisma.question.findUniqueOrThrow({ where: { id: state.question.id }, include: { steps: { include: { options: true } } } });
    const response = await api(`/api/diagnostics/${state.id}/answers`, cookie, "POST", { questionId: q.id, revision: state.revision, submissionId: randomUUID(),
      stepAnswers: q.steps.map((s: any) => ({ stepId: s.id, answer: wrong ? "not-correct" : s.type === "multiple_choice" ? s.options.find((o: any) => o.isCorrect).id : s.expectedAnswer })) });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    state = (await api(`/api/diagnostics/${state.id}`, cookie)).data;
  }
  return state;
}
export async function startCheck(cookie: string, nodeId: string, requestId = randomUUID()) {
  const result = await api("/api/preparation", cookie, "POST", { nodeId, action: "check", requestId });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data;
}
export async function finishCheck(cookie: string, examId: string, wrongSkillId?: string, skip = false) {
  const exam = await prisma.examSession.findUniqueOrThrow({ where: { id: examId } });
  const paper = exam.paper as unknown as PaperQuestion[];
  const state = (await api(`/api/exams/${examId}`, cookie)).data;
  const answers = skip ? {} : Object.fromEntries(paper.map(q => [q.id, wrongSkillId && q.skillIds.includes(wrongSkillId) ? (q.correctIndex + 1) % q.options.length : q.correctIndex]));
  const saved = await api(`/api/exams/${examId}`, cookie, "PATCH", { requestId: randomUUID(), revision: state.revision, currentIndex: 0, flaggedQuestionIds: [], answers });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const finished = await api(`/api/exams/${examId}/finish`, cookie, "POST", {});
  assert.equal(finished.status, 200, JSON.stringify(finished.data)); return finished.data;
}
/** Explicitly synthetic curriculum, only in an isolated database. Arithmetic has real, distinct answers.
 * The full final paper still uses the application's real reviewed exam bank. */
export async function preparationFixture() {
  requireTestDatabase();
  const fixture = await choiceFixture();
  const skillIds = [fixture.skill.id];
  for (let i = 1; i < 3; i++) {
    const s = await prisma.skill.create({ data: { id: `${fixture.run}-operation-${i}`, topicId: fixture.topic.id,
      nameRu: i === 1 ? "Вычитание" : "Умножение", nameKk: i === 1 ? "Азайту" : "Көбейту",
      explanationRu: "Вычислить значение выражения", explanationKk: "Өрнектің мәнін есептеу", ruleRu: "Проверяй действие и знак", ruleKk: "Амал мен таңбаны тексер" } });
    skillIds.push(s.id);
  }
  // Existing fixtures repeat one stem. Replace them with distinct arithmetic tasks for independence checks.
  await prisma.questionStep.deleteMany({ where: { question: { topicId: fixture.topic.id } } });
  await prisma.question.deleteMany({ where: { topicId: fixture.topic.id } });
  for (const [operation, skillId] of skillIds.entries()) for (let n = 2; n < 34; n++) {
    const id = `${fixture.run}-p${operation}-${n}`, result = operation === 0 ? n + 4 : operation === 1 ? n - 3 : n * 3;
    const expression = operation === 0 ? `${n}+4` : operation === 1 ? `${n}-3` : `${n}\\cdot 3`;
    const choice = { ...testChoice(id, false, skillId), questionText: `Вычислите $${expression}$.`, questionTextKk: `$${expression}$ мәнін есептеңіз.`,
      options: [result, result + 1, result - 1, result + 2, result - 2].map((value, i) => ({ id: `${id}-${i}`, text: String(value), textKk: String(value) })),
      explanation: `$${expression}=${result}$`, explanationKk: `$${expression}=${result}$`, solutionSteps: [{ prompt: "Вычислите", promptKk: "Есептеңіз", answer: String(result) }] };
    await prisma.question.create({ data: { id, topicId: fixture.topic.id, title: "Тестовое вычисление", titleKk: "Сынақ есебі", questionText: choice.questionText, questionTextKk: choice.questionTextKk,
      correctAnswer: String(result), answerType: "number", explanation: choice.explanation, explanationKk: choice.explanationKk, practiceChoice: choice as unknown as Prisma.InputJsonValue,
      skills: { create: { skillId } }, steps: { create: { type: "numeric_input", order: 1, prompt: "Вычислите", promptKk: "Есептеңіз", expectedAnswer: String(result), skills: { create: { skillId } } } } } });
  }
  async function cycle(userId = fixture.a.id) {
    return prisma.$transaction(async tx => {
      await lockAccount(tx, userId);
      const diagnostic = await tx.diagnosticSession.create({ data: { userId, questionIds: [], status: "completed", completedAt: new Date(), result: {} } });
      const program = await createProgramCycle(tx, userId, diagnostic.id, skillIds);
      assert.ok(program);
      // This fixture starts at checks; reinforcement is tested by actual failed assessments below.
      await tx.learningRoadNode.updateMany({ where: { blockId: program.id }, data: { phase: "check", repairSkillIds: [] } });
      await tx.learningRoadNode.updateMany({ where: { blockId: program.id, type: "SKILL" }, data: { reason: "confirmation" } });
      await tx.learningRoadBlock.update({ where: { id: program.id }, data: { reason: "initial" } });
      return program;
    });
  }
  return { ...fixture, skillIds, cycle };
}
