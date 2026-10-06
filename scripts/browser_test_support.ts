import { access, readdir } from "node:fs/promises";
import path from "node:path";

export async function chromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (process.platform !== "win32") return undefined;
  const root = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  for (const name of (await readdir(root)).filter(n => n.startsWith("chromium-")).sort().reverse()) {
    for (const folder of ["chrome-win64", "chrome-win"]) {
      const file = path.join(root, name, folder, "chrome.exe");
      try { await access(file); return file; } catch { /* Try the next installed browser. */ }
    }
  }
}
