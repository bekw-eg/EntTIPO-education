import assert from "node:assert/strict";
import { POST } from "../app/api/ai/tutor/route";

async function main() {
  const realFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw new Error("Retired AI must not contact a provider"); };
  try {
    for (const language of ["ru", "kk", "en"]) for (const action of ["hint", "chat", "analyze_error", "explain_formula"]) {
      const response = await POST(new Request("http://localhost/api/ai/tutor", { method: "POST",
        headers: { "Content-Type": "application/json", "x-ent-locale": language }, body: JSON.stringify({ action, language }) }));
      assert.equal(response.status, 410);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      const data = await response.json();
      assert.equal(data.href, "/exam");
      assert.equal(data.text, undefined);
    }
    assert.equal(providerCalls, 0);
    console.log("PASS: AI retired for every language/action, no hints or provider calls.");
  } finally { globalThis.fetch = realFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
