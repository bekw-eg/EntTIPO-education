import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { downloadPackage, downloadSchema } from "@/lib/offline/server";
import { offlineError } from "@/lib/offline/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const data = downloadSchema.parse(await request.json());
    const pack = await downloadPackage(userId, data);
    const assets = JSON.parse(await readFile(path.join(process.cwd(), "public/offline-assets/manifest.json"), "utf8"));
    return NextResponse.json({ ...pack.content as object, id: pack.id, userId, sessionId: pack.sessionId,
      contentVersion: pack.contentVersion, downloadedAt: pack.createdAt.toISOString(), assetsVersion: assets.version,
      assets, bytes: Buffer.byteLength(JSON.stringify(pack.content)), assetBytes: assets.files.reduce((sum: number, file: { bytes: number }) => sum + file.bytes, 0) });
  } catch (error) { return offlineError(error); }
}
