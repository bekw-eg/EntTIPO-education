import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { questionLocalizationSource } from "../lib/i18n/content";

export const baseUrl = process.env.OFFLINE_TEST_BASE_URL || "http://localhost:3000";
export const prisma = new PrismaClient();
export async function api(url: string, cookie = "", method = "GET", body?: unknown) {
  const response = await fetch(`${baseUrl}${url}`, { method, headers: { Cookie: cookie, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
  if (url.startsWith("/api/")) assert.match(response.headers.get("cache-control") || "", /no-store/);
  const data = await response.json(); return { response, data, status: response.status };
}
export async function fixture() {
  const run = `offline-${crypto.randomUUID()}`;
  const users: string[] = [];
  const topic = await prisma.topic.create({ data: { name: run, nameKk: `Тест ${run}`, description: "Offline test", order: 9999,
    lesson: { create: { title: "Offline materials", whatIsIt: "Fractions", whenUsed: "Practice", formulaLatex: "\\frac{1}{2}=0.5", example: "$1/2$", commonErrors: "Check division" } },
    skills: { create: { id: run, nameRu: "Test rule", nameKk: "Тест ереже", ruleRu: "Divide by two", ruleKk: "Екіге бөл", explanationRu: "Half", explanationKk: "Жарты" } },
    questions: { create: [0, 1, 2].map(index => ({ title: `${run} ${index}`, questionText: "Compute $1/2$", latex: "\\frac{1}{2}",
      correctAnswer: "0.5", answerType: "number", explanation: "Half equals 0.5", skills: { create: { skillId: run } },
      steps: { create: [
        { order: 1, type: "numeric_input", prompt: "Numeric result", expectedAnswer: "0.5", skills: { create: { skillId: run } } },
        { order: 2, type: "expression_input", prompt: "Simplify x+x", expectedAnswer: "2*x" },
        { order: 3, type: "multiple_choice", prompt: "Choose half", expectedAnswer: "0.5", options: { create: [
          { order: 0, text: "$1/2$", isCorrect: true }, { order: 1, text: "2", isCorrect: false },
        ] } },
      ] },
    })) },
  }, include: { questions: { include: { steps: { include: { options: true }, orderBy: { order: "asc" } } } } } });
  await prisma.lesson.update({ where: { topicId: topic.id }, data: { contentKk: {
    title: "Желісіз материалдар", whatIsIt: "Бөлшектер", whenUsed: "Жаттығу", formulaLatex: "\\frac{1}{2}=0.5", example: "$1/2$", commonErrors: "Бөлуді тексеріңіз",
  } } });
  for (const q of topic.questions) {
    await prisma.question.update({ where: { id: q.id }, data: { titleKk: `Жаттығу ${q.id}`, questionTextKk: "$1/2$ мәнін есептеңіз",
      explanationKk: "Жарты 0.5-ке тең", localizationSource: questionLocalizationSource(q) } });
    for (const s of q.steps) {
      await prisma.questionStep.update({ where: { id: s.id }, data: { promptKk: ["Сандық нәтиже", "x+x өрнегін ықшамдаңыз", "Жартыны таңдаңыз"][s.order - 1] } });
      for (const o of s.options) await prisma.questionOption.update({ where: { id: o.id }, data: { textKk: o.text } });
    }
  }
  async function register(label: string) {
    const email = `${run}-${label}@example.test`, password = "offline-test-password-123";
    const result = await api("/api/auth/register", "", "POST", { name: `${label} ${run}`, email, password });
    assert.equal(result.status, 200); users.push(result.data.user.id);
    return { id: result.data.user.id as string, email, password, cookie: (result.response.headers.get("set-cookie") || "").split(";")[0] };
  }
  const a = await register("A"), b = await register("B");
  return { run, topic, a, b, async cleanup() {
    // Delete only this fixture's rows; plain UserAttempt relations do not cascade.
    await prisma.mistake.deleteMany({ where: { userId: { in: users } } });
    await prisma.skillObservation.deleteMany({ where: { userId: { in: users } } });
    await prisma.userStepAnswer.deleteMany({ where: { attempt: { userId: { in: users } } } });
    await prisma.userAttempt.deleteMany({ where: { userId: { in: users } } });
    await prisma.offlinePackage.deleteMany({ where: { userId: { in: users } } });
    await prisma.practiceSession.deleteMany({ where: { userId: { in: users } } });
    await prisma.userTopicProgress.deleteMany({ where: { userId: { in: users } } });
    await prisma.dailyGoal.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.questionOption.deleteMany({ where: { step: { question: { topicId: topic.id } } } });
    await prisma.questionStep.deleteMany({ where: { question: { topicId: topic.id } } });
    await prisma.question.deleteMany({ where: { topicId: topic.id } });
    await prisma.skill.deleteMany({ where: { topicId: topic.id } });
    await prisma.lesson.deleteMany({ where: { topicId: topic.id } });
    await prisma.topic.delete({ where: { id: topic.id } });
    await prisma.$disconnect();
  } };
}
