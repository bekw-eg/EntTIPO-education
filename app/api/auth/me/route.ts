import { localizedJson } from "@/lib/i18n/http";
import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { DEMO_USER_ID, isDemoEnabled } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return localizedJson(req, { user: null, demoEnabled: isDemoEnabled() }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!user) {
      return localizedJson(req, { user: null }, { status: 401 });
    }

    return localizedJson(req, { user: { ...user, isDemo: user.id === DEMO_USER_ID } });
  } catch (err) {
    console.error("Auth me error:", err);
    return localizedJson(req, { user: null }, { status: 500 });
  }
}
