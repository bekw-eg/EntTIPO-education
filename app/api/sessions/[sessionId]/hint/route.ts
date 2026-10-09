import { retiredServiceResponse } from "@/lib/retiredService";
import { localizedJson } from "@/lib/i18n/http";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { PracticeError, recordHintUsage } from "@/lib/practiceStorage";

const hintRequestSchema = z.object({ questionId: z.string().min(1) });

async function archivedPOST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const parsed = hintRequestSchema.safeParse(await request.json());
    if (!parsed.success) return localizedJson(request, { error: "Question ID is required" }, { status: 400 });
    const { sessionId } = await context.params;
    return localizedJson(request, await recordHintUsage(userId, sessionId, parsed.data.questionId));
  } catch (error) {
    if (error instanceof SyntaxError) return localizedJson(request, { error: "Invalid JSON" }, { status: 400 });
    if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
    console.error("Failed to record hint usage:", error);
    return localizedJson(request, { error: "Could not record hint usage" }, { status: 500 });
  }
}

export async function POST() { return retiredServiceResponse(); }
