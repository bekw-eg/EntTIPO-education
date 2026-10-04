import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { diagnosticSubmissionSchema, submitDiagnostic } from "@/lib/diagnostics";
import { PracticeError } from "@/lib/practiceStorage";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    const { sessionId } = await context.params;
    return NextResponse.json(await submitDiagnostic(userId, sessionId, diagnosticSubmissionSchema.parse(await request.json())));
  } catch (error) {
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid diagnostic answer" }, { status: 400 });
    console.error("Could not save diagnostic answer", error);
    return NextResponse.json({ error: "Could not save answer" }, { status: 500 });
  }
}
