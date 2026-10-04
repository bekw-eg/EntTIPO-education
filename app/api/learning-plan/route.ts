import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { getDailyLearningPlan, runPlanAction } from "@/lib/dailyLearningPlan";
import { PracticeError } from "@/lib/practiceStorage";

export const dynamic = "force-dynamic";
const operation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("recalculate") }).strict(),
  z.object({ action: z.enum(["start", "complete_rule"]), actionId: z.string().min(1) }).strict(),
]);
function failure(error: unknown) {
  if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid plan request" }, { status: 400 });
  console.error("Learning plan failed", error);
  return NextResponse.json({ error: "Could not load learning plan" }, { status: 500 });
}
export async function GET(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  try { return NextResponse.json(await getDailyLearningPlan(userId)); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    const data = operation.parse(await request.json());
    return NextResponse.json(data.action === "recalculate" ? await getDailyLearningPlan(userId, new Date(), true)
      : await runPlanAction(userId, data.actionId, data.action));
  } catch (error) { return failure(error); }
}
