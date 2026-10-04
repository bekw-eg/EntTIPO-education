import { localizedJson } from "@/lib/i18n/http";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse(request);
    const data = await getDashboardData(userId);
    return localizedJson(request, data);
  } catch (error) {
    console.error("Error in GET /api/dashboard:", error);
    return localizedJson(request, { error: "Internal server error" }, { status: 500 });
  }
}
