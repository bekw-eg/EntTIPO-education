import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageUserId } from "@/lib/user";
import { getExamProfile, TIPO_MATH } from "@/lib/exam/profile";
import { readCoverage } from "@/lib/exam/database";
import ExamCoverageView from "@/components/exam/ExamCoverageView";

export const dynamic = "force-dynamic";
export default async function CoveragePage({ searchParams }: { searchParams: Promise<{ profile?: string }> }) {
  await requirePageUserId();
  const profile = getExamProfile((await searchParams).profile ?? TIPO_MATH.id);
  if (!profile) notFound();
  const [reportRu, reportKk] = await Promise.all([readCoverage(prisma, profile), readCoverage(prisma, profile, "kk")]);
  return <ExamCoverageView reportRu={reportRu} reportKk={reportKk} />;
}
