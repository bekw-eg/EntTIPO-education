import { prisma } from "./prisma";
import { SessionMode } from "@/types";
import { readUserSkills } from "./skillProgress";
import { PracticeError } from "./practiceStorage";
import { Prisma } from "@prisma/client";
import { capChoiceQuestions } from "./practiceChoice";

export interface UserSkillProfile {
  topWeakSkills: string[];
  weakTopicIds: string[];
  unreviewedQuestionIds: string[];
  subtopicIdsWithMistakes: string[];
}

/**
 * Extracts student's accumulated weak skills, error patterns, and unmastered areas
 * from the Mistake table.
 */
export async function getUserSkillProfile(userId: string): Promise<UserSkillProfile> {
  const mistakes = await prisma.mistake.findMany({
    where: { userId },
    select: {
      questionId: true,
      topicId: true,
      subtopicId: true,
      weakSkill: true,
      skillId: true,
      errorType: true,
      isReviewed: true,
      confirmedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const skillWeights = new Map<string, number>();
  const topicWeights = new Map<string, number>();
  const subtopicSet = new Set<string>();
  const unreviewedQIds: string[] = [];

  for (const m of mistakes) {
    const penalty = m.confirmedAt ? 1 : 3;

    if (!m.confirmedAt) {
      unreviewedQIds.push(m.questionId);
    }
    if (m.subtopicId) {
      subtopicSet.add(m.subtopicId);
    }
    topicWeights.set(m.topicId, (topicWeights.get(m.topicId) || 0) + penalty);

    if (m.skillId) {
      skillWeights.set(m.skillId, (skillWeights.get(m.skillId) || 0) + penalty);
    }
  }

  const skills = await readUserSkills(prisma, userId);
  for (const skill of skills) {
    if (skill.state !== "insufficient" && skill.state !== "mastered" && skill.recentFailureCount > 0) {
      skillWeights.set(skill.id, (skillWeights.get(skill.id) ?? 0) + skill.recentFailureCount * 5);
    } else skillWeights.delete(skill.id);
  }

  const topWeakSkills = Array.from(skillWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([skill]) => skill)
    .slice(0, 5);

  const weakTopicIds = Array.from(topicWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([topicId]) => topicId)
    .slice(0, 5);

  return {
    topWeakSkills,
    weakTopicIds,
    unreviewedQuestionIds: Array.from(new Set(unreviewedQIds)),
    subtopicIdsWithMistakes: Array.from(subtopicSet),
  };
}

/**
 * Adaptive question selection algorithm with Weak-Skill targeting.
 *
 * Distribution for mixed mode:
 * - 40% targeted weak skills & weak topics (mastery < 40 or accumulated mistakes)
 * - 25% recently practiced (last 7 days)
 * - 20% random repetition
 * - 15% challenge (level above current)
 */
export async function selectQuestionsForSession({
  ...settings
}: {
  userId: string; count: number; mode: SessionMode; topicId?: string; skillId?: string; questionId?: string;
}): Promise<string[]> {
  const preferred = await selectPreferredQuestions(settings);
  const eligible = await prisma.question.findMany({ where: {
    purpose: "practice", practiceChoice: { not: Prisma.DbNull },
    ...(settings.topicId ? { topicId: settings.topicId } : {}),
    ...(settings.skillId ? { skills: { some: { skillId: settings.skillId } } } : {}),
  }, select: { id: true, practiceChoice: true }, orderBy: [{ difficulty: "asc" }, { id: "asc" }] });
  const ordered = [...preferred.map(id => eligible.find(q => q.id === id)).filter((q): q is typeof eligible[number] => !!q),
    ...eligible.filter(q => !preferred.includes(q.id))];
  const selected = capChoiceQuestions(ordered, settings.count).map(q => q.id);
  if (settings.questionId && !selected.includes(settings.questionId)) throw new PracticeError("Requested question has no reviewed single-answer choices", 400);
  return selected;
}

async function selectPreferredQuestions({
  userId,
  count,
  mode,
  topicId,
  skillId,
  questionId,
}: {
  userId: string;
  count: number;
  mode: SessionMode;
  topicId?: string;
  skillId?: string;
  questionId?: string;
}): Promise<string[]> {
  if (skillId) {
    if (!await prisma.skill.findUnique({ where: { id: skillId } })) throw new PracticeError("Skill not found", 404);
    const questions = await prisma.question.findMany({ where: { purpose: "practice", skills: { some: { skillId } },
      ...(topicId ? { topicId } : {}) }, select: { id: true }, orderBy: [{ difficulty: "asc" }, { id: "asc" }] });
    if (questionId && !questions.some((q) => q.id === questionId)) throw new PracticeError("Question does not test the requested skill", 400);
    return [...(questionId ? [questionId] : []), ...questions.filter((q) => q.id !== questionId).map((q) => q.id)].slice(0, count);
  }
  switch (mode) {
    case "specific_topic":
      return selectFromTopic(userId, topicId!, count);
    case "weak_topics":
      return selectWeakTopics(userId, count);
    case "review_mistakes":
      return selectMistakeQuestions(userId, count);
    case "mixed":
    default:
      return selectMixed(userId, count);
  }
}

async function selectMixed(userId: string, count: number): Promise<string[]> {
  const [progress, skillProfile] = await Promise.all([
    prisma.userTopicProgress.findMany({
      where: { userId },
      include: { topic: true },
    }),
    getUserSkillProfile(userId),
  ]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Categorize topics: masteryScore < 40 OR topics with high unreviewed mistakes
  const lowMasteryTopicIds = progress
    .filter((p) => p.masteryScore < 40)
    .map((p) => p.topicId);

  const combinedWeakTopicIds = Array.from(
    new Set([...lowMasteryTopicIds, ...skillProfile.weakTopicIds])
  );

  const recentTopics = progress.filter(
    (p) => p.lastAttemptAt && p.lastAttemptAt > sevenDaysAgo
  );

  const allTopics = await prisma.topic.findMany({ select: { id: true } });

  // Build weighted pool
  const pool: { questionId: string; weight: number }[] = [];

  // 1. Weak-Skill & Micro-Skill targeted questions (Highest priority)
  const weakSkillTargetCount = Math.ceil(count * 0.4);
  const targetedQuestions = await getQuestionsForWeakSkills(
    skillProfile,
    userId,
    weakSkillTargetCount * 2
  );
  targetedQuestions.forEach((qId) => pool.push({ questionId: qId, weight: 5.5 }));

  // 2. Additional questions from weak topics
  if (combinedWeakTopicIds.length > 0) {
    const weakQuestions = await getQuestionsFromTopics(
      combinedWeakTopicIds,
      userId,
      weakSkillTargetCount * 2
    );
    weakQuestions.forEach((qId) => pool.push({ questionId: qId, weight: 3.5 }));
  }

  // 3. Recently practiced topics
  const recentCount = Math.ceil(count * 0.25);
  if (recentTopics.length > 0) {
    const recentIds = recentTopics.map((t) => t.topicId);
    const recentQuestions = await getQuestionsFromTopics(
      recentIds,
      userId,
      recentCount * 2
    );
    recentQuestions.forEach((qId) => pool.push({ questionId: qId, weight: 2.0 }));
  }

  // 4. Random repetition + challenge from all topics
  const randomCount = Math.ceil(count * 0.35);
  const allIds = allTopics.map((t) => t.id);
  const randomQuestions = await getQuestionsFromTopics(
    allIds,
    userId,
    randomCount * 2
  );
  randomQuestions.forEach((qId) => pool.push({ questionId: qId, weight: 1.0 }));

  // Weighted random selection without replacement
  const guaranteed = targetedQuestions.slice(0, weakSkillTargetCount);
  const selected = [...guaranteed, ...weightedSampleWithoutReplacement(pool.filter((q) => !guaranteed.includes(q.questionId)), count - guaranteed.length)];

  // If pool didn't have enough, fill with any available questions
  if (selected.length < count) {
    const existingSet = new Set(selected);
    const fillQuestions = await prisma.question.findMany({
      where: { purpose: "practice", id: { notIn: Array.from(existingSet) } },
      select: { id: true },
      take: count - selected.length,
    });
    fillQuestions.forEach((q) => selected.push(q.id));
  }

  return selected;
}

async function selectWeakTopics(
  userId: string,
  count: number
): Promise<string[]> {
  const [weakProgress, skillProfile] = await Promise.all([
    prisma.userTopicProgress.findMany({
      where: { userId, masteryScore: { lt: 50 } },
      orderBy: { masteryScore: "asc" },
      take: 5,
    }),
    getUserSkillProfile(userId),
  ]);

  const progressTopicIds = weakProgress.map((p) => p.topicId);
  const candidateTopicIds = Array.from(
    new Set([...progressTopicIds, ...skillProfile.weakTopicIds])
  );

  const topicIds =
    candidateTopicIds.length > 0
      ? candidateTopicIds.slice(0, 5)
      : (await prisma.topic.findMany({ select: { id: true }, take: 5 })).map(
          (t) => t.id
        );

  // First, retrieve questions directly targeting weak skills
  const targetedQuestions = await getQuestionsForWeakSkills(
    skillProfile,
    userId,
    count
  );

  const selectedSet = new Set<string>(targetedQuestions);

  // Fill remaining from general weak topics
  if (selectedSet.size < count) {
    const remainingCount = count - selectedSet.size;
    const topicQuestions = await getQuestionsFromTopics(
      topicIds,
      userId,
      remainingCount * 3
    );
    for (const qId of topicQuestions) {
      if (!selectedSet.has(qId)) {
        selectedSet.add(qId);
        if (selectedSet.size >= count) break;
      }
    }
  }

  // Fallback if still under count
  if (selectedSet.size < count) {
    const all = await prisma.question.findMany({
      where: { purpose: "practice", id: { notIn: Array.from(selectedSet) } },
      select: { id: true },
      take: count - selectedSet.size,
    });
    all.forEach((q) => selectedSet.add(q.id));
  }

  return Array.from(selectedSet).slice(0, count);
}

async function selectFromTopic(
  userId: string,
  topicId: string,
  count: number
): Promise<string[]> {
  const [progress, topicMistakes] = await Promise.all([
    prisma.userTopicProgress.findUnique({
      where: { userId_topicId: { userId, topicId } },
    }),
    prisma.mistake.findMany({
      where: { userId, topicId },
      select: { questionId: true, confirmedAt: true, weakSkill: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const currentLevel = progress?.currentLevel ?? 1;

  // Unreviewed mistake questions in this topic
  const mistakeQIds = topicMistakes
    .filter((m) => !m.confirmedAt)
    .map((m) => m.questionId);

  let questions = await prisma.question.findMany({
    where: {
      topicId,
      purpose: "practice",
      difficulty: {
        gte: Math.max(1, currentLevel - 1),
        lte: Math.min(5, currentLevel + 1),
      },
    },
    select: { id: true, title: true },
    orderBy: { difficulty: "asc" },
  });

  if (questions.length === 0) {
    questions = await prisma.question.findMany({
      where: { topicId, purpose: "practice" },
      select: { id: true, title: true },
    });
  }

  // Prioritize mistake questions and shuffle the rest
  const prioritySet = new Set(mistakeQIds);
  const prioritized: string[] = [];
  const others: string[] = [];

  for (const q of questions) {
    if (prioritySet.has(q.id)) {
      prioritized.push(q.id);
    } else {
      others.push(q.id);
    }
  }

  const result = [...prioritized, ...shuffle(others)];
  return result.slice(0, count);
}

async function selectMistakeQuestions(
  userId: string,
  count: number
): Promise<string[]> {
  const mistakes = await prisma.mistake.findMany({
    where: { userId, confirmedAt: null },
    select: { questionId: true },
    distinct: ["questionId"],
    orderBy: { createdAt: "desc" },
    take: count * 2,
  });

  const ids = mistakes.map((m) => m.questionId);
  if (ids.length >= count) return ids.slice(0, count);

  // Fill remaining from weak topics
  const remaining = count - ids.length;
  const extra = await selectWeakTopics(userId, remaining);
  return [...new Set([...ids, ...extra])].slice(0, count);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Queries questions targeting student's specific unmastered skills.
 */
async function getQuestionsForWeakSkills(
  profile: UserSkillProfile,
  userId: string,
  limit: number
): Promise<string[]> {
  if (limit <= 0) return [];
  const targetedQuestionIds = new Set<string>();

  if (profile.topWeakSkills.length > 0) {
    const candidates = await prisma.question.findMany({ where: {
      purpose: "practice", skills: { some: { skillId: { in: profile.topWeakSkills } } },
    }, select: { id: true, skills: { select: { skillId: true } },
      attempts: { where: { userId }, take: 1, select: { id: true } } }, orderBy: [{ difficulty: "asc" }, { id: "asc" }] });
    candidates.sort((a, b) => Number(a.attempts.length > 0) - Number(b.attempts.length > 0) ||
      Math.min(...a.skills.map((s) => profile.topWeakSkills.indexOf(s.skillId)).filter((i) => i >= 0)) -
      Math.min(...b.skills.map((s) => profile.topWeakSkills.indexOf(s.skillId)).filter((i) => i >= 0)));
    for (const skillId of profile.topWeakSkills) {
      const question = candidates.find((q) => q.skills.some((s) => s.skillId === skillId));
      if (question && targetedQuestionIds.size < limit) targetedQuestionIds.add(question.id);
    }
    for (const q of candidates) { if (targetedQuestionIds.size >= limit) break; targetedQuestionIds.add(q.id); }
  }

  // 1. Unreviewed mistake questions (direct retry)
  for (const qId of profile.unreviewedQuestionIds) {
    if (targetedQuestionIds.size >= limit) break;
    targetedQuestionIds.add(qId);
    if (targetedQuestionIds.size >= limit) break;
  }

  // 2. Questions sharing subtopics where the user made mistakes
  if (targetedQuestionIds.size < limit && profile.subtopicIdsWithMistakes.length > 0) {
    const subtopicQuestions = await prisma.question.findMany({
      where: {
        subtopicId: { in: profile.subtopicIdsWithMistakes },
        purpose: "practice",
        id: { notIn: Array.from(targetedQuestionIds) },
      },
      select: { id: true },
      take: limit - targetedQuestionIds.size,
    });
    subtopicQuestions.forEach((q) => targetedQuestionIds.add(q.id));
  }

  return Array.from(targetedQuestionIds);
}

async function getQuestionsFromTopics(
  topicIds: string[],
  userId: string,
  limit: number
): Promise<string[]> {
  if (topicIds.length === 0) return [];

  // Avoid recently attempted questions in the last 24h
  const recentAttempts = await prisma.userAttempt.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { questionId: true },
    distinct: ["questionId"],
  });
  const recentIds = new Set(recentAttempts.map((a) => a.questionId));

  let questions = await prisma.question.findMany({
    where: {
      topicId: { in: topicIds },
      purpose: "practice",
      id: { notIn: Array.from(recentIds) },
    },
    select: { id: true },
    take: limit,
  });

  // Fallback if all questions were recently attempted
  if (questions.length === 0) {
    questions = await prisma.question.findMany({
      where: {
        topicId: { in: topicIds },
        purpose: "practice",
      },
      select: { id: true },
      take: limit,
    });
  }

  return shuffle(questions.map((q) => q.id));
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function weightedSampleWithoutReplacement(
  pool: { questionId: string; weight: number }[],
  count: number
): string[] {
  if (pool.length === 0) return [];

  const selected: string[] = [];
  const remaining = [...pool];
  const seen = new Set<string>();

  while (selected.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    let chosenIndex = 0;
    for (let i = 0; i < remaining.length; i++) {
      random -= remaining[i].weight;
      if (random <= 0) {
        chosenIndex = i;
        break;
      }
    }

    const chosen = remaining[chosenIndex];
    if (!seen.has(chosen.questionId)) {
      selected.push(chosen.questionId);
      seen.add(chosen.questionId);
    }
    remaining.splice(chosenIndex, 1);
  }

  return selected;
}
