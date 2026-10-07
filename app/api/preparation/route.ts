import { z, ZodError } from "zod";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { localizedJson, requestLocale } from "@/lib/i18n/http";
import { getPreparation, runPreparation } from "@/lib/learning-road/program";
import { PracticeError } from "@/lib/practiceStorage";
import { preparationText } from "@/lib/i18n/preparation";

export const dynamic = "force-dynamic";
const input = z.object({ nodeId: z.string().min(1).max(200), action: z.enum(["check", "practice"]), requestId: z.string().uuid() }).strict();
function failure(error: unknown, request: Request) {
  const copy = preparationText[requestLocale(request)];
  if (error instanceof PracticeError) return localizedJson(request, { error: copy.errors[error.message as keyof typeof copy.errors] ?? error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return localizedJson(request, { error: copy.invalid }, { status: 400 });
  console.error("Preparation failed", error);
  return localizedJson(request, { error: copy.error }, { status: 500 });
}
export async function GET(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try { return localizedJson(request, await getPreparation(userId)); } catch (error) { return failure(error, request); }
}
export async function POST(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const data = input.parse(await request.json());
    return localizedJson(request, await runPreparation(userId, data.nodeId, data.action, data.requestId, requestLocale(request) === "kk" ? "kk" : "ru"));
  } catch (error) { return failure(error, request); }
}
