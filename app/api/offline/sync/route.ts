import { retiredServiceResponse } from "@/lib/retiredService";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { syncMetaSchema } from "@/lib/offline/server";
import { submitAttemptSchema } from "@/lib/validators";
import { submitAttempt } from "@/lib/submitAttempt";
import { offlineError } from "@/lib/offline/http";
import { PracticeError } from "@/lib/practiceStorage";

export const dynamic = "force-dynamic";
async function archivedPOST(request: NextRequest) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const body = await request.json();
    const meta = syncMetaSchema.parse(body);
    if (meta.userId !== userId) throw new PracticeError("REAUTH_REQUIRED", 403);
    const data = submitAttemptSchema.parse(body);
    const result = await submitAttempt(userId, data, meta) as { submissionId?: string; offlineRevision?: number };
    if (result.submissionId !== data.submissionId || result.offlineRevision === undefined) throw new PracticeError("SUBMISSION_ID_CONFLICT", 409);
    return NextResponse.json({ submissionId: data.submissionId, revision: result.offlineRevision, result });
  } catch (error) { return offlineError(error); }
}

export async function POST() { return retiredServiceResponse(); }
