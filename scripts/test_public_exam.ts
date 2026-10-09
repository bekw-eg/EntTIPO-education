import assert from "node:assert/strict";
import { retiredPages } from "../lib/publicFeatures";

const base = process.env.EXAM_TEST_BASE_URL ?? "http://127.0.0.1:3100";
async function main() {
  for (const root of retiredPages) {
    for (const path of [root, `${root}/saved-item?legacy=1`]) {
      const response = await fetch(base + path, { redirect: "manual" });
      assert.equal(response.status, 307, path);
      assert.equal(new URL(response.headers.get("location")!, base).pathname, "/exam", path);
    }
  }
  console.log(`PASS: ${retiredPages.length} archived sections and nested URLs redirect to the exam.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
