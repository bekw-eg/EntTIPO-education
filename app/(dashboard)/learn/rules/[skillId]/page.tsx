import { notFound, redirect } from "next/navigation";
import { requirePageUserId } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { LearningRule } from "@/components/dashboard/LearningRule";

export const dynamic = "force-dynamic";
export default async function RulePage({ params, searchParams }: {
  params: Promise<{ skillId: string }>; searchParams: Promise<{ actionId?: string }>;
}) {
  const userId = await requirePageUserId();
  const activeExam = await prisma.examSession.findFirst({ where: { userId, status: "active" }, select: { id: true } });
  if (activeExam) redirect(`/exam/${activeExam.id}`);
  const { skillId } = await params, { actionId } = await searchParams;
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) notFound();
  const action = actionId ? await prisma.learningPlanAction.findFirst({ where: { id: actionId, skillId, kind: "rule", status: { not: "superseded" }, plan: { userId } } }) : null;
  if (actionId && !action) notFound();
  return <LearningRule skill={skill} actionId={action?.id} completed={!!action?.completedAt} />;
}
