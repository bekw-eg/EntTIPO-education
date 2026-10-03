import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const data = await getDashboardData(userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in GET /api/dashboard:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
