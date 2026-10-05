import { localizedJson } from "@/lib/i18n/http";
import { z, ZodError } from "zod";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { getDailyLearningPlan, runPlanAction } from "@/lib/dailyLearningPlan";
import { PracticeError } from "@/lib/practiceStorage";

export const dynamic = "force-dynamic";
const operation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("recalculate") }).strict(),
  z.object({ action: z.enum(["start", "complete_rule"]), actionId: z.string().min(1) }).strict(),
]);
function failure(error: unknown, request: Request) {
  if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return localizedJson(request, { error: "Invalid plan request" }, { status: 400 });
  console.error("Learning plan failed", error);
  return localizedJson(request, { error: "Could not load learning plan" }, { status: 500 });
}
export async function GET(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try { return localizedJson(request, await getDailyLearningPlan(userId)); } catch (error) { return failure(error, request); }
}
export async function POST(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const data = operation.parse(await request.json());
    return localizedJson(request, data.action === "recalculate" ? await getDailyLearningPlan(userId, new Date(), true)
      : await runPlanAction(userId, data.actionId, data.action));
  } catch (error) { return failure(error, request); }
}
