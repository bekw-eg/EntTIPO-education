import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";

// Integration tests need a dedicated database. Never reset or seed the application's DB.
async function main() {
  const database = process.env.OFFLINE_TEST_DATABASE_URL;
  if (!database) throw new Error("Set OFFLINE_TEST_DATABASE_URL to a dedicated PostgreSQL test database");
  const port = Number(process.env.OFFLINE_TEST_PORT || 31064);
  const base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, DATABASE_URL: database, SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
    MATH_SERVICE_URL: process.env.OFFLINE_TEST_MATH_URL || "http://127.0.0.1:59999", OFFLINE_TEST_BASE_URL: base,
    SESSION_TEST_BASE_URL: base, AUTH_TEST_BASE_URL: base, PROGRESS_TEST_BASE_URL: base };
  const server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], { env, stdio: "inherit", windowsHide: true });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await fetch(`${base}/api/auth/me`)).status === 401) { ready = true; break; } } catch { /* startup */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("Test server did not start");
    const scripts = process.env.OFFLINE_TEST_SCRIPTS?.split(",") ?? ["test_offline_http.ts", "test_offline_browser.ts", "test_practice_persistence.ts", "test_practice_progress.ts", "test_account_isolation.ts"];
    for (const script of scripts) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", `scripts/${script}`], { env, stdio: "inherit", windowsHide: true, timeout: 180000 });
        child.once("error", reject); child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${script} failed (${code})`)));
      });
    }
  } finally { server.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
