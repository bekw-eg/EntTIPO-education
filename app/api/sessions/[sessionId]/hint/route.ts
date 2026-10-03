import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { PracticeError, recordHintUsage } from "@/lib/practiceStorage";

const hintRequestSchema = z.object({ questionId: z.string().min(1) });

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    const parsed = hintRequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    const { sessionId } = await context.params;
    return NextResponse.json(await recordHintUsage(userId, sessionId, parsed.data.questionId));
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to record hint usage:", error);
    return NextResponse.json({ error: "Could not record hint usage" }, { status: 500 });
  }
}
