import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { lockAccount, PracticeError } from "@/lib/practiceStorage";
import { assertNoActiveExam } from "@/lib/exam/guard";
import { currentContent, packageChoiceSnapshots } from "@/lib/offline/server";
import type { OfflineContent, OfflineLanguage } from "@/lib/offline/types";
import { offlineError } from "@/lib/offline/http";

export async function GET(request: NextRequest, context: { params: Promise<{ packageId: string }> }) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const { packageId } = await context.params;
    const state = await prisma.$transaction(async tx => {
      await lockAccount(tx, userId);
      await assertNoActiveExam(tx, userId);
      const pack = await tx.offlinePackage.findFirst({ where: { id: packageId, userId }, include: { session: true } });
      if (!pack) throw new PracticeError("Package not found", 404);
      const content = pack.content as unknown as OfflineContent;
      const current = await currentContent(tx, content.topicIds, content.questions.map(q => q.id), pack.language as OfflineLanguage,
        packageChoiceSnapshots(pack));
      return { userId, sessionId: pack.sessionId, revision: pack.session.revision, currentVersion: current.version };
    });
    return NextResponse.json(state);
  } catch (error) { return offlineError(error); }
}
