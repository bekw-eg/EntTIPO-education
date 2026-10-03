import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, DEMO_USER_ID, createSessionToken, isDemoEnabled } from "@/lib/auth";

export async function POST() {
  if (!isDemoEnabled()) {
    return NextResponse.json({ error: "Деморежим отключён" }, { status: 404 });
  }
  const user = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Демопрофиль не настроен" }, { status: 404 });
  }
  const token = createSessionToken(user.id);
  const response = NextResponse.json({ user: { ...user, isDemo: true } });
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
