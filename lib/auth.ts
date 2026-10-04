import crypto from "crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "ent_tipo_session";
export const DEMO_USER_ID = "cluser0000000000000000001";

export function isDemoEnabled(): boolean {
  return process.env.ENABLE_DEMO_MODE === "true";
}

const authGlobal = globalThis as typeof globalThis & { entTipoSessionSecret?: string };

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured in production");
  }
  // Keep development sessions stable across hot reloads without a public default key.
  return (authGlobal.entTipoSessionSecret ??= crypto.randomBytes(32).toString("hex"));
}

/**
 * Hashes a password using PBKDF2 with a unique salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored salt:hash string.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;

    const testHash = crypto
      .pbkdf2Sync(password, salt, 10000, 64, "sha512")
      .toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(testHash));
  } catch {
    return false;
  }
}

/**
 * Generates a signed session token for a given user ID.
 */
export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  const base64Payload = Buffer.from(payload).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(base64Payload)
    .digest("base64url");

  return `${base64Payload}.${signature}`;
}

/**
 * Verifies a session token and extracts the user ID.
 */
export function verifySessionToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [base64Payload, signature] = parts;
    if (!base64Payload || !signature) return null;

    const expectedSignature = crypto
      .createHmac("sha256", getSessionSecret())
      .update(base64Payload)
      .digest("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(base64Payload, "base64url").toString("utf-8")
    );

    if (
      !payload ||
      typeof payload.userId !== "string" ||
      !payload.userId.trim() ||
      typeof payload.expiresAt !== "number" ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload.userId;
  } catch {
    return null;
  }
}

/**
 * Gets currently logged in user ID from Next.js cookies,
 * or null if not logged in.
 */
export async function getSessionUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    const userId = verifySessionToken(token);
    return userId === DEMO_USER_ID && !isDemoEnabled() ? null : userId;
  } catch {
    return null;
  }
}
