import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { lockAccount, PracticeError } from "../practiceStorage";
import { assertNoActiveExam } from "../exam/guard";
import { contentText, missingQuestionTranslations } from "../i18n/content";
import { getLocalizedLesson } from "../i18n/lessons";
import type { OfflineContent, OfflineLanguage, OfflineStep } from "./types";
import { simpleNumber } from "./grading";
import { z } from "zod";

export const downloadSchema = z.object({
  downloadId: z.string().uuid(), topicIds: z.array(z.string().min(1)).min(1).max(16),
  language: z.enum(["ru", "kk"]), count: z.number().int().min(1).max(50),
}).strict();
export const syncMetaSchema = z.object({
  userId: z.string().min(1), packageId: z.string().uuid(), contentVersion: z.string().length(64),
  sequence: z.number().int().min(0).max(49), revision: z.number().int().nonnegative(),
  acceptedVersion: z.string().length(64).optional(), reconcile: z.boolean().optional(),
});
export type SyncMeta = z.infer<typeof syncMetaSchema>;

/** Hash server-owned keys, question structure and materials, never the client's claimed grade. */
export async function currentContent(tx: Prisma.TransactionClient, topicIds: string[], questionIds: string[], language: OfflineLanguage) {
  const topics = await tx.topic.findMany({ where: { id: { in: topicIds } }, orderBy: { id: "asc" }, include: { lesson: true, skills: { orderBy: { id: "asc" } } } });
  const unordered = await tx.question.findMany({ where: { id: { in: questionIds }, purpose: "practice", NOT: { id: { startsWith: "exam_v1_" } } },
    include: { steps: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } } });
  const questions = questionIds.map(id => unordered.find(q => q.id === id)).filter((q): q is NonNullable<typeof q> => !!q);
  if (questions.length !== questionIds.length || topics.length !== topicIds.length) throw new PracticeError("PACKAGE_CONTENT_UNAVAILABLE", 409);
  if (language === "kk" && questions.some(q => missingQuestionTranslations(q).length)) throw new PracticeError("PACKAGE_TRANSLATION_UNAVAILABLE", 409);
  const content: OfflineContent = {
    format: 1, topicIds, language, title: topics.map(t => contentText(t.name, t.nameKk, language)).join(" · "),
    rules: topics.flatMap(t => t.skills.map(s => ({ id: s.id, title: language === "kk" ? s.nameKk : s.nameRu,
      text: language === "kk" ? `${s.ruleKk}\n${s.explanationKk}` : `${s.ruleRu}\n${s.explanationRu}` }))),
    materials: topics.flatMap(t => {
      const localized = getLocalizedLesson(t.id, language);
      const lesson = localized ?? (language === "kk" ? t.lesson?.contentKk as unknown as typeof localized : t.lesson);
      return lesson ? [{ title: lesson.title, text: [lesson.whatIsIt, lesson.whenUsed, lesson.example, lesson.commonErrors].join("\n\n"), latex: lesson.formulaLatex }] : [];
    }),
    questions: questions.map(q => ({ id: q.id, title: contentText(q.title, q.titleKk, language),
      text: contentText(q.questionText, q.questionTextKk, language), latex: q.latex,
      steps: q.steps.map(s => {
        const options = s.options.map(o => ({ id: o.id, text: contentText(o.text, o.textKk, language) }));
        let localKey: OfflineStep["localKey"];
        const correct = s.options.filter(o => o.isCorrect);
        if (s.type === "multiple_choice" && correct.length === 1) localKey = { kind: "choice", value: correct[0].id };
        if (s.type === "multiple_select" && correct.length) localKey = { kind: "select", value: JSON.stringify(correct.map(o => o.id)) };
        if (s.type === "numeric_input" && simpleNumber(s.expectedAnswer) !== null) localKey = { kind: "number", value: s.expectedAnswer };
        return { id: s.id, type: s.type, prompt: contentText(s.prompt, s.promptKk, language), options, ...(localKey ? { localKey } : {}) };
      }),
    })),
  };
  const grading = questions.map(q => [q.id, q.difficulty, q.correctAnswer, q.explanation, q.explanationKk,
    q.steps.map(s => [s.id, s.type, s.expectedAnswer, s.options.map(o => [o.id, o.isCorrect])])]);
  const version = createHash("sha256").update(JSON.stringify([content, grading])).digest("hex");
  return { content, version };
}

export async function downloadPackage(userId: string, data: z.infer<typeof downloadSchema>) {
  const topicIds = [...new Set(data.topicIds)].sort();
  const selectionHash = createHash("sha256").update(JSON.stringify([topicIds, data.language, data.count])).digest("hex");
  return prisma.$transaction(async tx => {
    await lockAccount(tx, userId);
    await assertNoActiveExam(tx, userId);
    const previous = await tx.offlinePackage.findUnique({ where: { id: data.downloadId } });
    if (previous) {
      if (previous.userId !== userId) throw new PracticeError("Package not found", 404);
      if (previous.selectionHash !== selectionHash) {
        throw new PracticeError("Download ID already belongs to another selection", 409);
      }
      return previous;
    }
    const candidates = await tx.question.findMany({ where: { purpose: "practice", NOT: { id: { startsWith: "exam_v1_" } }, topicId: { in: topicIds }, steps: { some: {} } },
      select: { id: true, topicId: true }, orderBy: [{ difficulty: "asc" }, { id: "asc" }] });
    // Round-robin ensures selected topics are represented before filling the count.
    const groups = topicIds.map(id => candidates.filter(q => q.topicId === id));
    if (groups.some(group => !group.length)) throw new PracticeError("A selected topic has no practice questions", 400);
    if (data.count < topicIds.length) throw new PracticeError("Select at least one question per topic", 400);
    const questionIds: string[] = [];
    for (let index = 0; questionIds.length < data.count; index++) {
      const row = groups.flatMap(group => group[index] ? [group[index].id] : []);
      if (!row.length) break;
      questionIds.push(...row.slice(0, data.count - questionIds.length));
    }
    const { content, version } = await currentContent(tx, topicIds, questionIds, data.language);
    const session = await tx.practiceSession.create({ data: { userId, mode: "offline_practice", questionIds,
      totalCount: questionIds.length, hintedQuestionIds: questionIds } });
    // Exposure remains durable even after the browser deletes this package.
    await tx.questionHelp.createMany({ data: questionIds.map(questionId => ({ userId, questionId })), skipDuplicates: true });
    return tx.offlinePackage.create({ data: { id: data.downloadId, userId, sessionId: session.id,
      language: data.language, contentVersion: version, selectionHash, content: content as unknown as Prisma.InputJsonValue } });
  }, { maxWait: 10000, timeout: 20000 });
}

export async function validateOffline(tx: Prisma.TransactionClient, userId: string, sessionId: string, questionId: string, meta: SyncMeta, checkRevision: boolean) {
  if (meta.userId !== userId) throw new PracticeError("REAUTH_REQUIRED", 403);
  const pack = await tx.offlinePackage.findFirst({ where: { id: meta.packageId, userId, sessionId }, include: { session: true } });
  if (!pack) throw new PracticeError("Package not found", 404);
  if (pack.contentVersion !== meta.contentVersion) throw new PracticeError("STALE_PACKAGE", 409);
  const content = pack.content as unknown as OfflineContent;
  if (content.questions[meta.sequence]?.id !== questionId) throw new PracticeError("QUEUE_ORDER_CONFLICT", 409);
  const current = await currentContent(tx, content.topicIds, content.questions.map(q => q.id), pack.language as OfflineLanguage);
  if (current.version !== pack.contentVersion && meta.acceptedVersion !== current.version) throw new PracticeError("STALE_PACKAGE", 409);
  const original = content.questions[meta.sequence], updated = current.content.questions[meta.sequence];
  if (JSON.stringify(original.steps.map(s => [s.id, s.type, s.options.map(o => o.id)])) !== JSON.stringify(updated.steps.map(s => [s.id, s.type, s.options.map(o => o.id)]))) {
    throw new PracticeError("PACKAGE_STRUCTURE_CHANGED", 409);
  }
  if (checkRevision && (pack.session.revision !== meta.revision || (!meta.reconcile && pack.session.currentIndex !== meta.sequence))) {
    throw new PracticeError("SESSION_CONFLICT", 409);
  }
  return pack;
}
