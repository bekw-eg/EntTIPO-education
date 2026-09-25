import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";
import { TopicDetailView } from "@/components/topics/TopicDetailView";

export const dynamic = "force-dynamic";

interface TopicDetailPageProps {
  params: Promise<{ topicId: string }>;
}

export default async function TopicDetailPage({ params }: TopicDetailPageProps) {
  const userId = getCurrentUserId();
  const { topicId } = await params;

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      lesson: true,
      subtopics: true,
      questions: {
        take: 3,
        include: { steps: true },
        orderBy: { difficulty: "asc" },
      },
      progress: {
        where: { userId },
      },
    },
  });

  if (!topic) {
    notFound();
  }

  const masteryScore = topic.progress[0]?.masteryScore ?? 0;

  return <TopicDetailView topic={topic} masteryScore={masteryScore} />;
}
