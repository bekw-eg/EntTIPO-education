import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { choiceSchema, makeChoiceSnapshots, parseChoice } from "../practiceChoice";
import type { PaperQuestion } from "../exam/mode";
import { hasContentTranslation } from "../i18n/content";

export const contentKey = (text: string) => text.toLowerCase().replace(/\s|\$/g, "");

/** Include every channel that can have revealed an answer, including downloaded offline packages. */
export async function independentBank(tx: Prisma.TransactionClient, userId: string, skillIds: string[], language: "ru" | "kk") {
  const [attempts, help, diagnostics, exams, hinted, pending] = await Promise.all([
    tx.userAttempt.findMany({ where: { userId }, select: { questionId: true } }),
    tx.questionHelp.findMany({ where: { userId }, select: { questionId: true } }),
    tx.diagnosticAnswer.findMany({ where: { session: { userId } }, select: { questionId: true } }),
    tx.examSession.findMany({ where: { userId }, select: { questionIds: true, paper: true } }),
    tx.practiceSession.findMany({ where: { userId }, select: { hintedQuestionIds: true, choiceSnapshots: true } }),
    tx.learningCheck.findMany({ where: { userId, status: "pending" }, select: { questionId: true } }),
  ]);
  const exposed = new Set([...attempts, ...help, ...diagnostics, ...pending].map(a => a.questionId));
  exams.forEach(e => e.questionIds.forEach(id => exposed.add(id)));
  hinted.forEach(s => s.hintedQuestionIds.forEach(id => exposed.add(id)));
  const old = await tx.question.findMany({ where: { id: { in: [...exposed] } }, select: { questionText: true, practiceChoice: true } });
  const exposedContent = new Set(old.flatMap(q => {
    const choice = choiceSchema.safeParse(q.practiceChoice);
    return [contentKey(q.questionText), ...(choice.success ? [contentKey(choice.data.questionText)] : [])];
  }));
  for (const exam of exams) for (const q of exam.paper as unknown as PaperQuestion[]) {
    exposedContent.add(contentKey(q.controlChoice?.questionText ?? q.questionText));
  }
  for (const session of hinted) for (const [id, value] of Object.entries(session.choiceSnapshots as Record<string, unknown>)) {
    if (exposed.has(id)) { const c = choiceSchema.safeParse(value); if (c.success) exposedContent.add(contentKey(c.data.questionText)); }
  }
  const bank = await tx.question.findMany({ where: { purpose: { in: ["practice", "verification"] },
    skills: { some: { skillId: { in: skillIds } } } }, orderBy: [{ purpose: "desc" }, { difficulty: "asc" }, { id: "asc" }],
    include: { topic: true, skills: { include: { skill: true } }, steps: { include: { skills: true } } } });
  return bank.filter(q => {
    const parsed = choiceSchema.safeParse(q.practiceChoice);
    if (!parsed.success || parsed.data.type !== "single" || exposed.has(q.id)) return false;
    const choice = parsed.data;
    return !exposedContent.has(contentKey(choice.questionText)) &&
      skillIds.some(id => choice.skillIds.includes(id) && q.skills.some(s => s.skillId === id) && q.steps.some(s => s.skills.some(link => link.skillId === id))) &&
      (language !== "kk" || hasContentTranslation(choice.questionText, choice.questionTextKk) &&
        hasContentTranslation(choice.explanation, choice.explanationKk) && choice.options.every(o => !!o.textKk));
  });
}

export async function prepareControl(tx: Prisma.TransactionClient, userId: string, skillIds: string[], perSkill: number, language: "ru" | "kk") {
  const bank = await independentBank(tx, userId, skillIds, language);
  const selected: typeof bank = [], fingerprints = new Set<string>();
  const shortages: { skillId: string; available: number; required: number }[] = [];
  // A task is credited only to explicitly mapped skills; duplicate stems never count twice.
  for (const skillId of skillIds) {
    const candidates = bank.filter(q => parseChoice(q.practiceChoice).skillIds.includes(skillId) &&
      q.skills.some(s => s.skillId === skillId) && q.steps.some(s => s.skills.some(l => l.skillId === skillId)));
    let count = selected.filter(q => candidates.some(c => c.id === q.id)).length;
    for (const candidate of candidates) {
      if (count >= perSkill) break;
      const key = contentKey(parseChoice(candidate.practiceChoice).questionText);
      if (fingerprints.has(key)) continue;
      selected.push(candidate); fingerprints.add(key); count++;
    }
    if (count < perSkill) shortages.push({ skillId, available: count, required: perSkill });
  }
  if (shortages.length) return { paper: null, shortages };
  const snapshots = await makeChoiceSnapshots(tx, selected.map(q => q.id));
  const paper: PaperQuestion[] = selected.map(q => {
    const choice = parseChoice((snapshots as Record<string, unknown>)[q.id]);
    const links = q.skills.filter(s => choice.skillIds.includes(s.skillId) && q.steps.some(step => step.skills.some(l => l.skillId === s.skillId)));
    return { id: q.id, contentHash: createHash("sha256").update(JSON.stringify(choice)).digest("hex"), pointCode: q.topicId,
      band: q.difficulty >= 4 ? "C" : q.difficulty >= 2 ? "B" : "A", family: q.id,
      topicId: q.topicId, topicName: language === "kk" ? q.topic.nameKk ?? q.topic.name : q.topic.name,
      skillIds: links.map(s => s.skillId), skillNames: links.map(s => language === "kk" ? s.skill.nameKk : s.skill.nameRu),
      title: language === "kk" ? q.titleKk ?? q.title : q.title,
      questionText: language === "kk" ? choice.questionTextKk! : choice.questionText, latex: choice.latex,
      options: choice.options.map(o => language === "kk" ? o.textKk! : o.text),
      correctIndex: choice.options.findIndex(o => choice.correctOptionIds.includes(o.id)),
      explanation: language === "kk" ? choice.explanationKk! : choice.explanation,
      difficulty: q.difficulty, previouslyExposed: false, controlChoice: choice };
  });
  return { paper, shortages };
}
