import { localizedJson } from "@/lib/i18n/http";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";

export async function GET(request: Request) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse(request);
    const users = await prisma.user.findMany({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 1,
    });

    return localizedJson(request, { users });
  } catch (err) {
    return localizedJson(request, { users: [] }, { status: 500 });
  }
}
