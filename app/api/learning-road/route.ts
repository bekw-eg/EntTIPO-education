import { z, ZodError } from "zod";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { localizedJson, requestLocale } from "@/lib/i18n/http";
import { roadText } from "@/lib/i18n/learning-road";
import { getLearningRoad, runRoadNode } from "@/lib/learning-road/service";
import { PracticeError } from "@/lib/practiceStorage";

export const dynamic = "force-dynamic";
const operation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("next_block") }).strict(),
  z.object({ action: z.enum(["start", "complete_theory", "skip_unavailable"]), nodeId: z.string().min(1).max(200) }).strict(),
]);
function failure(error: unknown, request: Request) {
  const copy = roadText[requestLocale(request)];
  if (error instanceof PracticeError) return localizedJson(request,
    { error: copy.errors[error.message as keyof typeof copy.errors] ?? error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return localizedJson(request, { error: copy.invalidRequest }, { status: 400 });
  console.error("Learning road failed", error);
  return localizedJson(request, { error: copy.error }, { status: 500 });
}
export async function GET(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try { return localizedJson(request, await getLearningRoad(userId)); } catch (error) { return failure(error, request); }
}
export async function POST(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const data = operation.parse(await request.json());
    return localizedJson(request, data.action === "next_block" ? await getLearningRoad(userId, true) : await runRoadNode(userId, data.nodeId, data.action));
  } catch (error) { return failure(error, request); }
}
