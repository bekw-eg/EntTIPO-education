import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";
import { TopicsView } from "@/components/topics/TopicsView";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const userId = getCurrentUserId();

  const topics = await prisma.topic.findMany({
    orderBy: { order: "asc" },
    include: {
      lesson: true,
      progress: {
        where: { userId },
      },
      _count: { select: { questions: true } },
    },
  });

  const topicsWithProgress = topics.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    difficulty: t.difficulty,
    order: t.order,
    masteryScore: t.progress[0]?.masteryScore ?? 0,
    questionsCount: t._count.questions,
  }));

  return <TopicsView topics={topicsWithProgress} />;
}
