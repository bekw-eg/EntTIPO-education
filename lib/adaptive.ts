import { prisma } from "./prisma";
import { SessionMode } from "@/types";

/**
 * Adaptive question selection algorithm.
 *
 * Distribution for mixed mode:
 * - 40% weak topics (mastery < 40)
 * - 25% recently practiced (last 7 days)
 * - 20% random repetition
 * - 15% challenge (level above current)
 */
export async function selectQuestionsForSession({
  userId,
  count,
  mode,
  topicId,
}: {
  userId: string;
  count: number;
  mode: SessionMode;
  topicId?: string;
}): Promise<string[]> {
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
  const progress = await prisma.userTopicProgress.findMany({
    where: { userId },
    include: { topic: true },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Categorize topics
  const weakTopics = progress.filter((p) => p.masteryScore < 40);
  const recentTopics = progress.filter(
    (p) => p.lastAttemptAt && p.lastAttemptAt > sevenDaysAgo
  );

  const allTopics = await prisma.topic.findMany({ select: { id: true } });

  // Build weighted pool
  const pool: { questionId: string; weight: number }[] = [];

  // 40% from weak topics
  const weakCount = Math.ceil(count * 0.4);
  if (weakTopics.length > 0) {
    const weakIds = weakTopics.map((t) => t.topicId);
    const weakQuestions = await getQuestionsFromTopics(
      weakIds,
      userId,
      weakCount * 3
    );
    weakQuestions.forEach((q) => pool.push({ questionId: q, weight: 4 }));
  }

  // 25% from recent topics
  const recentCount = Math.ceil(count * 0.25);
  if (recentTopics.length > 0) {
    const recentIds = recentTopics.map((t) => t.topicId);
    const recentQuestions = await getQuestionsFromTopics(
      recentIds,
      userId,
      recentCount * 3
    );
    recentQuestions.forEach((q) => pool.push({ questionId: q, weight: 2.5 }));
  }

  // 20% random + 15% challenge from all topics
  const randomCount = Math.ceil(count * 0.35);
  const allIds = allTopics.map((t) => t.id);
  const randomQuestions = await getQuestionsFromTopics(
    allIds,
    userId,
    randomCount * 3
  );
  randomQuestions.forEach((q) => pool.push({ questionId: q, weight: 1 }));

  // Weighted random selection without replacement
  const selected = weightedSampleWithoutReplacement(pool, count);

  // If pool didn't have enough, fill with any available questions
  if (selected.length < count) {
    const existingSet = new Set(selected);
    const fillQuestions = await prisma.question.findMany({
      where: { id: { notIn: Array.from(existingSet) } },
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
  const weakProgress = await prisma.userTopicProgress.findMany({
    where: { userId, masteryScore: { lt: 50 } },
    orderBy: { masteryScore: "asc" },
    take: 5,
  });

  const topicIds =
    weakProgress.length > 0
      ? weakProgress.map((p) => p.topicId)
      : (await prisma.topic.findMany({ select: { id: true }, take: 5 })).map(
          (t) => t.id
        );

  const questions = await getQuestionsFromTopics(topicIds, userId, count * 3);
  const selected = questions.slice(0, count);

  if (selected.length < count) {
    const all = await prisma.question.findMany({ select: { id: true }, take: count });
    return all.map((q) => q.id);
  }

  return selected;
}

async function selectFromTopic(
  userId: string,
  topicId: string,
  count: number
): Promise<string[]> {
  const progress = await prisma.userTopicProgress.findUnique({
    where: { userId_topicId: { userId, topicId } },
  });

  const currentLevel = progress?.currentLevel ?? 1;

  let questions = await prisma.question.findMany({
    where: {
      topicId,
      difficulty: {
        gte: Math.max(1, currentLevel - 1),
        lte: Math.min(5, currentLevel + 1),
      },
    },
    select: { id: true },
    orderBy: { difficulty: "asc" },
  });

  if (questions.length === 0) {
    questions = await prisma.question.findMany({
      where: { topicId },
      select: { id: true },
    });
  }

  const ids = questions.map((q) => q.id);
  return shuffle(ids).slice(0, count);
}

async function selectMistakeQuestions(
  userId: string,
  count: number
): Promise<string[]> {
  const mistakes = await prisma.mistake.findMany({
    where: { userId, isReviewed: false },
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

async function getQuestionsFromTopics(
  topicIds: string[],
  userId: string,
  limit: number
): Promise<string[]> {
  if (topicIds.length === 0) return [];

  // Get recently attempted questions to avoid immediate repetition
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
