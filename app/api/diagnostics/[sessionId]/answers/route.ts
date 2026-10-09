import { retiredServiceResponse } from "@/lib/retiredService";
import { localizedJson } from "@/lib/i18n/http";
import { ZodError } from "zod";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { diagnosticSubmissionSchema, submitDiagnostic } from "@/lib/diagnostics";
import { PracticeError } from "@/lib/practiceStorage";

async function archivedPOST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const { sessionId } = await context.params;
    return localizedJson(request, await submitDiagnostic(userId, sessionId, diagnosticSubmissionSchema.parse(await request.json())));
  } catch (error) {
    if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError) return localizedJson(request, { error: "Invalid diagnostic answer" }, { status: 400 });
    console.error("Could not save diagnostic answer", error);
    return localizedJson(request, { error: "Could not save answer" }, { status: 500 });
  }
}

export async function POST() { return retiredServiceResponse(); }
