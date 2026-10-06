import { redirect } from "next/navigation";
import { requirePageUserId } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { LearningRoadView } from "@/components/learning-road/LearningRoadView";

export const dynamic = "force-dynamic";
export default async function LearningRoadPage() {
  const userId = await requirePageUserId();
  const exam = await prisma.examSession.findFirst({ where: { userId, status: "active" }, select: { id: true } });
  if (exam) redirect(`/exam/${exam.id}`);
  return <LearningRoadView />;
}
