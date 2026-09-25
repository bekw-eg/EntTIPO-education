import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/user";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = getCurrentUserId();
    const data = await getDashboardData(userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in GET /api/dashboard:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
