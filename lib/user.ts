import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { verifySessionToken, getSessionUserId, AUTH_COOKIE_NAME, DEMO_USER_ID, isDemoEnabled } from "./auth";

/** Resolve only signed credentials; guests and invalid credentials have no user ID. */
export function getCurrentUserId(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  let token: string | undefined;
  if (authorization !== null) {
    if (!authorization.startsWith("Bearer ")) return null;
    token = authorization.substring(7);
  } else {
    token = request.headers.get("cookie")
      ?.split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${AUTH_COOKIE_NAME}=`))
      ?.slice(AUTH_COOKIE_NAME.length + 1);
  }
  if (!token) return null;
  const userId = verifySessionToken(token);
  return userId === DEMO_USER_ID && !isDemoEnabled() ? null : userId;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Для доступа к личным данным необходимо войти в аккаунт" },
    { status: 401, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function requirePageUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return userId;
}
