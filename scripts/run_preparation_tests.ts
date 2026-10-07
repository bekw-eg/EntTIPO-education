import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";

/** Starts only a production server against an explicitly named isolated test database.
 * No db reset, seed or migration of the working DATABASE_URL. Server lifetime is bounded to this run. */
async function main() {
  const database = process.env.PREPARATION_TEST_DATABASE_URL;
  assert.ok(database, "Set PREPARATION_TEST_DATABASE_URL to an isolated PostgreSQL database");
  const url = new URL(database);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && /test/i.test(url.pathname), "Only a local explicitly named test database is allowed");
  const require = createRequire(import.meta.url), port = 3100, base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, DATABASE_URL: database, NEXT_BUILD_DIR: process.env.NEXT_BUILD_DIR ?? ".next-smoke",
    SESSION_SECRET: randomBytes(48).toString("hex"), CHOICE_TEST_BASE_URL: base, SKILLS_TEST_BASE_URL: base,
    PLAN_TEST_BASE_URL: base, EXAM_TEST_BASE_URL: base, AUTH_TEST_BASE_URL: base, KAZAKH_TEST_BASE_URL: base,
    PROGRESS_TEST_BASE_URL: base, SESSION_TEST_BASE_URL: base, OFFLINE_TEST_BASE_URL: base };
  try { await fetch(`${base}/api/auth/me`, { signal: AbortSignal.timeout(1000) }); throw new Error("Test port already in use; stop its server first"); }
  catch (e) { if (e instanceof Error && e.message.includes("already in use")) throw e; }
  await mkdir("tmp/preparation", { recursive: true });
  const log = createWriteStream("tmp/preparation/server.log");
  const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--port", String(port)], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.pipe(log); server.stderr.pipe(log);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      assert.equal(server.exitCode, null, "Production server exited; inspect tmp/preparation/server.log");
      try { ready = (await fetch(`${base}/api/auth/me`, { signal: AbortSignal.timeout(1000) })).status === 401; } catch { /* Startup */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready, "Production server did not become ready");
    const available: Record<string, string[]> = {
      new: ["test_preparation_unit", "test_preparation_http"],
      browser: ["test_preparation_browser"],
      units: ["test_auth_security", "test_progress_unit", "test_practice_storage", "test_skill_diagnostics_unit", "test_daily_learning_unit", "test_exam_coverage_unit", "test_exam_mode_unit", "test_kazakh_content_unit", "test_offline_unit", "test_choice_unit", "test_result_analysis_unit", "test_learning_road_unit"],
      integration: ["test_account_isolation", "test_skill_diagnostics", "test_daily_learning_plan", "test_exam_coverage", "test_exam_math", "test_exam_http", "test_exam_mode", "test_kazakh_content", "test_kazakh_ai", "test_choice_http", "test_choice_migration", "test_learning_road_http"],
      regression: ["test_choice_browser", "test_result_analysis_browser", "test_learning_road_browser", "test_ui_smoke"],
    };
    const groups = process.argv.slice(2).length ? process.argv.slice(2) : ["new", "units", "integration", "browser", "regression"];
    const failures: string[] = [];
    for (const group of groups) {
      assert.ok(available[group], `Unknown test group: ${group}`);
      for (const script of available[group]) {
        const output = createWriteStream(`tmp/preparation/${script}.log`);
        const child = spawn(process.execPath, [require.resolve("tsx/cli"), `scripts/${script}.ts`], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        child.stdout.pipe(output); child.stderr.pipe(output); child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
        const code = await new Promise<number | null>(resolve => child.on("exit", resolve));
        output.end(); console.log(`${code === 0 ? "PASS" : "FAIL"} ${script}`);
        if (code !== 0) failures.push(script);
      }
    }
    assert.deepEqual(failures, [], "Test suites failed");
  } finally { server.kill(); log.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
