import { verifySessionToken, AUTH_COOKIE_NAME } from "./auth";

/**
 * Default fallback user ID for demo / guest mode and automated tests.
 */
export const SINGLE_USER_ID = "cluser0000000000000000001";

/**
 * Returns the currently authenticated user ID from request headers/cookies,
 * or gracefully falls back to the default user ID.
 */
export function getCurrentUserId(request?: Request): string {
  if (request) {
    // 1. Check Authorization: Bearer <token>
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const verified = verifySessionToken(token);
      if (verified) return verified;
    }

    // 2. Check Cookie header (ent_tipo_session=<token>)
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
      if (match && match[1]) {
        const verified = verifySessionToken(match[1]);
        if (verified) return verified;
      }
    }

    // 3. Check X-User-Id header (for internal testing / student switching)
    const customUserId = request.headers.get("X-User-Id");
    if (customUserId) {
      return customUserId;
    }
  }

  return SINGLE_USER_ID;
}
