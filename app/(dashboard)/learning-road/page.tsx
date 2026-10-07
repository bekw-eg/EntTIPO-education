import { redirect } from "next/navigation";
import { requirePageUserId } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { LearningRoadView } from "@/components/learning-road/LearningRoadView";
import { PreparationView } from "@/components/learning-road/PreparationView";

export const dynamic = "force-dynamic";
export default async function LearningRoadPage({ searchParams }: { searchParams: Promise<{ legacy?: string }> }) {
  const userId = await requirePageUserId();
  const exam = await prisma.examSession.findFirst({ where: { userId, status: "active" }, select: { id: true } });
  if (exam) redirect(`/exam/${exam.id}`);
  return (await searchParams).legacy === "1" ? <LearningRoadView /> : <PreparationView />;
}
