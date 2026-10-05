import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { AUTH_COOKIE_NAME, DEMO_USER_ID, createSessionToken, verifySessionToken } from "../lib/auth";
import { getCurrentUserId } from "../lib/user";
import { navigateAfterAuth } from "../lib/client-auth";

async function main() {
  process.env.SESSION_SECRET = "account-isolation-unit-test-secret";
  process.env.ENABLE_DEMO_MODE = "false";
  const token = createSessionToken("student-a");
  const req = (headers: Record<string, string> = {}) => new Request("http://localhost/api/user", { headers });
  assert.equal(getCurrentUserId(req()), null);
  assert.equal(getCurrentUserId(req({ "X-User-Id": "student-a" })), null);
  assert.equal(getCurrentUserId(req({ Cookie: `${AUTH_COOKIE_NAME}=${token}` })), "student-a");
  assert.equal(getCurrentUserId(req({ Cookie: `other_${AUTH_COOKIE_NAME}=${token}` })), null);
  assert.equal(getCurrentUserId(req({ Authorization: `Bearer ${token}`, "X-User-Id": "student-b" })), "student-a");
  assert.equal(getCurrentUserId(req({ Authorization: "Bearer invalid", Cookie: `${AUTH_COOKIE_NAME}=${token}` })), null);
  assert.equal(verifySessionToken(`${token}.extra`), null);
  assert.equal(verifySessionToken(`tampered.${token.split(".")[1]}`), null);

  const sign = (payload: unknown) => {
    const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${value}.${crypto.createHmac("sha256", process.env.SESSION_SECRET!).update(value).digest("base64url")}`;
  };
  for (const payload of [null, { userId: "student-a" }, { userId: "student-a", expiresAt: Date.now() - 1 },
    { userId: {}, expiresAt: Date.now() + 10000 }, { userId: "", expiresAt: Date.now() + 10000 }]) {
    assert.equal(verifySessionToken(sign(payload)), null);
  }
  const demoToken = createSessionToken(DEMO_USER_ID);
  assert.equal(getCurrentUserId(req({ Authorization: `Bearer ${demoToken}` })), null);
  process.env.ENABLE_DEMO_MODE = "true";
  assert.equal(getCurrentUserId(req({ Authorization: `Bearer ${demoToken}` })), DEMO_USER_ID);
  process.env.ENABLE_DEMO_MODE = "false";
  const oldEnvironment = process.env.NODE_ENV;
  delete process.env.SESSION_SECRET;
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.throws(() => createSessionToken("student-a"), /SESSION_SECRET/);
  Object.assign(process.env, { NODE_ENV: oldEnvironment });
  process.env.SESSION_SECRET = "account-isolation-unit-test-secret";
  console.log("PASS: signed credentials, cookie matching, header spoofing, token expiration and demo gating");

  const handlers: Record<string, (event: any) => void> = {};
  const matched: string[] = [];
  const written: string[] = [];
  const deleted: string[] = [];
  const fetched: { url: string; cache?: string }[] = [];
  let offline = false;
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL, Response, console,
    self: { location: { origin: "https://ent.example" }, skipWaiting() {}, clients: { claim() {} },
      addEventListener(name: string, handler: (event: any) => void) { handlers[name] = handler; } },
    caches: {
      async keys() { return ["ent-tipo-v1.0.0", "ent-tipo-static-v2", "ent-tipo-static-v3", "unrelated-cache"]; },
      async delete(key: string) { deleted.push(key); },
      async open() { return { async put(request: any) { written.push(request.url); }, async addAll() {} }; },
      async match(request: any) {
        const url = typeof request === "string" ? request : request.url;
        matched.push(url);
        return new Response(url === "/offline.html" ? "offline" : "OLD ACCOUNT DATA");
      },
    },
    async fetch(request: any, options?: { cache?: string }) {
      fetched.push({ url: request.url, cache: options?.cache });
      if (offline) throw new Error("offline");
      return new Response("CURRENT ACCOUNT DATA");
    },
  });
  let activation: Promise<unknown> | undefined;
  handlers.activate({ waitUntil(value: Promise<unknown>) { activation = value; } });
  await activation;
  assert.deepEqual(deleted, ["ent-tipo-v1.0.0", "ent-tipo-static-v2", "ent-tipo-static-v3"]);
  async function requestWorker(path: string, mode = "cors") {
    let response: Promise<Response> | undefined;
    handlers.fetch({ request: { url: `https://ent.example${path}`, method: "GET", mode },
      respondWith(value: Promise<Response>) { response = value; } });
    assert.ok(response);
    return response;
  }
  assert.equal(await (await requestWorker("/api/user")).text(), "CURRENT ACCOUNT DATA");
  assert.equal(await (await requestWorker("/", "navigate")).text(), "CURRENT ACCOUNT DATA");
  assert.equal(await (await requestWorker("/topics?_rsc=account-a")).text(), "CURRENT ACCOUNT DATA");
  assert.equal(await (await requestWorker("/topics/private.svg", "navigate")).text(), "CURRENT ACCOUNT DATA");
  assert.deepEqual(matched, []);
  assert.deepEqual(written, []);
  assert.ok(fetched.every((request) => request.cache === "no-store"));
  offline = true;
  await assert.rejects(requestWorker("/api/user"), /offline/);
  assert.equal(await (await requestWorker("/", "navigate")).text(), "offline");
  assert.deepEqual(matched, ["/offline.html"]);
  console.log("PASS: service worker never caches or restores personal API, HTML or RSC data");

  const storage: Record<string, any> = {
    enttipo_ai_dialog_q_shared: "old account history",
    enttipo_ai_user_student_a_q_1: "account A history",
    ent_tipo_locale: "kk",
    removeItem(key: string) { delete this[key]; },
    setItem(key: string, value: string) { this[key] = value; },
  };
  const cleared: string[] = [];
  let navigation = "";
  const browserCaches = {
    async keys() { return ["ent-tipo-v1.0.0", "ent-tipo-static-v2", "other-app"]; },
    async delete(key: string) { cleared.push(key); return true; },
  };
  Object.assign(globalThis, {
    localStorage: storage, caches: browserCaches,
    window: { caches: browserCaches, location: { assign(path: string) { navigation = path; } } },
  });
  await navigateAfterAuth("/");
  assert.equal(navigation, "/");
  assert.equal(storage.enttipo_ai_dialog_q_shared, undefined);
  assert.equal(storage.enttipo_ai_user_student_a_q_1, "account A history");
  assert.equal(storage.ent_tipo_locale, "kk");
  assert.ok(storage.enttipo_auth_changed);
  assert.deepEqual(cleared, ["ent-tipo-v1.0.0"]);
  cleared.length = 0;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("storage blocked"); } });
  await navigateAfterAuth("/login");
  assert.equal(navigation, "/login");
  assert.deepEqual(cleared, ["ent-tipo-v1.0.0"]);
  console.log("PASS: account changes clear shared history/cache, retain public assets and work with blocked storage");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
