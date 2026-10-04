import { prisma } from "@/lib/prisma";
import { DashboardStats } from "@/types";
import { addDays, dayBounds, localDay, studentTimeZone } from "./learningPolicy";

export async function getDashboardData(userId: string): Promise<DashboardStats> {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timeZone: true } });
    const timeZone = studentTimeZone(user.timeZone);
    const { day, gte: todayMidnight, lt: tomorrow } = dayBounds(new Date(), timeZone);

    const [
      todayAttempts,
      dailyGoal,
      overallAttempts,
      weakTopics,
      strongTopics,
      recentAttempts,
    ] = await Promise.all([
      prisma.userAttempt.findMany({
        where: {
          userId,
          createdAt: { gte: todayMidnight, lt: tomorrow },
        },
        select: { questionId: true },
      }),
      prisma.dailyGoal.findFirst({
        where: {
          userId,
          date: { gte: todayMidnight, lt: tomorrow },
        },
      }),
      prisma.userAttempt.findMany({
        where: { userId },
        select: { questionId: true, isCorrect: true },
      }),
      prisma.userTopicProgress.findMany({
        where: { userId, masteryScore: { lt: 40 } },
        orderBy: { masteryScore: "asc" },
        take: 5,
        include: { topic: true },
      }),
      prisma.userTopicProgress.findMany({
        where: { userId, masteryScore: { gte: 70 } },
        orderBy: { masteryScore: "desc" },
        take: 5,
        include: { topic: true },
      }),
      prisma.userAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { question: { include: { topic: true } } },
      }),
    ]);

    const todaySolved = new Set(todayAttempts.map((a) => a.questionId)).size;
    const totalSolved = new Set(overallAttempts.map((a) => a.questionId)).size;
    const totalAttempts = overallAttempts.length;
    const todayTarget = dailyGoal?.targetCount ?? 20;
    const correctCount = overallAttempts.filter((a) => a.isCorrect).length;
    const overallAccuracy =
      overallAttempts.length > 0
        ? Math.round((correctCount / overallAttempts.length) * 100)
        : 0;

    // Streak calculation
    const attemptDates = await prisma.userAttempt.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const dateStrings = [
      ...new Set(attemptDates.map((a) => localDay(a.createdAt, timeZone))),
    ];
    let streak = 0;
    const today = day;
    const yesterday = addDays(day, -1);

    if (dateStrings[0] === today || dateStrings[0] === yesterday) {
      streak = 1;
      for (let i = 1; i < dateStrings.length; i++) {
        if (addDays(dateStrings[i - 1], -1) === dateStrings[i]) streak++;
        else break;
      }
    }

    return {
      timeZone,
      totalSolved,
      totalAttempts,
      todaySolved,
      todayTarget,
      overallAccuracy,
      streak,
      weakTopics: weakTopics as any,
      strongTopics: strongTopics as any,
      recentAttempts: recentAttempts as any,
      dailyGoal: dailyGoal ? { ...dailyGoal, completedCount: todaySolved } as any : null,
    };
  } catch (error) {
    console.error("Error in getDashboardData:", error);
    return {
      timeZone: studentTimeZone(null),
      totalSolved: 0,
      totalAttempts: 0,
      todaySolved: 0,
      todayTarget: 20,
      overallAccuracy: 0,
      streak: 0,
      weakTopics: [],
      strongTopics: [],
      recentAttempts: [],
      dailyGoal: null,
    };
  }
}
