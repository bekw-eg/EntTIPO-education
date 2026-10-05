import assert from "node:assert/strict";
import { chromium, expect, type Page } from "@playwright/test";
import { readdir, access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fixture, prisma, baseUrl } from "./offline_test_fixture";

async function executable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (process.platform !== "win32") return undefined;
  const root = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  const candidates = (await readdir(root).catch(() => [])).filter(name => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const candidate of candidates) for (const folder of ["chrome-win64", "chrome-win"]) {
    const file = path.join(root, candidate, folder, "chrome.exe");
    try { await access(file); return file; } catch { /* another installed revision */ }
  }
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("enttipo-offline-v1", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const read = (name: string) => new Promise<any[]>((resolve, reject) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const packages = await read("packages"), queue = await read("queue"), work = await read("work"); db.close();
    return { packages, queue, work };
  });
}
async function fill(page: Page, numeric = "1/2") {
  await page.getByRole("textbox", { name: "Numeric result" }).fill(numeric);
  await page.getByRole("textbox", { name: "Simplify x+x" }).fill("x+x");
  await page.locator('input[type="radio"]').first().check();
  await expect(page.locator("#draft-status")).toHaveText("Сохранено на устройстве");
}
async function main() {
  const f = await fixture();
  const browser = await chromium.launch({ headless: true, executablePath: await executable() });
  const context = await browser.newContext({ serviceWorkers: "allow" });
  context.setDefaultTimeout(20000);
  context.setDefaultNavigationTimeout(30000);
  // tsx's function-name helper is otherwise lost when Playwright serializes evaluate callbacks.
  await context.addInitScript("globalThis.__name = (fn) => fn;");
  let page = await context.newPage();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const origin = new URL(baseUrl);
  async function login(cookie: string) {
    const separator = cookie.indexOf("=");
    await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), domain: origin.hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  }
  async function signIn(user: { email: string; password: string }) {
    await page.goto(`${baseUrl}/login`);
    await page.locator("#page-login-email").fill(user.email);
    await page.locator("#page-login-password").fill(user.password);
    await page.getByRole("button", { name: "Войти в кабинет", exact: true }).click();
    await page.waitForURL(`${baseUrl}/`);
    await page.goto(`${baseUrl}/offline-practice.html`);
  }
  try {
    await login(f.a.cookie); await page.goto(`${baseUrl}/offline-practice.html`);
    await page.getByLabel(f.run, { exact: true }).check();
    await page.getByLabel("Количество заданий (1–50)").fill("3");
    await page.getByRole("button", { name: "Скачать пакет", exact: true }).click();
    await expect(page.getByText("Доступно офлайн", { exact: true }).last()).toBeVisible({ timeout: 60000 });
    const initial = await stored(page); assert.equal(initial.packages.length, 1); const pack = initial.packages[0];
    assert.equal(pack.questions.length, 3); assert.equal(pack.rules.length, 1);
    const cacheUrls = await page.evaluate(async () => {
      const result: string[] = []; for (const name of await caches.keys()) for (const entry of await (await caches.open(name)).keys()) result.push(new URL(entry.url).pathname); return result;
    });
    assert.ok(cacheUrls.includes("/offline-practice.html")); assert.ok(cacheUrls.every(url => !url.startsWith("/api/") && !url.startsWith("/practice")));
    await page.getByRole("button", { name: "Открыть тренировку", exact: true }).click();
    await context.setOffline(true); await page.reload();
    await page.getByRole("button", { name: "Открыть тренировку", exact: true }).click();
    await expect(page.getByText("Нет сети. Можно продолжать скачанную тренировку.")).toBeVisible();
    await expect(page.locator("[data-question-id] .katex").first()).toBeVisible();
    await fill(page); await page.getByRole("button", { name: "Проверить предварительно и сохранить отправку" }).click();
    await expect(page.getByText("Ожидает проверки", { exact: true })).toBeVisible();
    const firstId = (await stored(page)).queue[0].submissionId;
    await page.getByRole("button", { name: "Следующее", exact: true }).click();
    await page.getByRole("textbox", { name: "Numeric result" }).fill("0,5");
    await expect(page.locator("#draft-status")).toHaveText("Сохранено на устройстве");
    await page.close(); page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${baseUrl}/offline-practice.html`); await page.getByRole("button", { name: "Открыть тренировку", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Numeric result" })).toHaveValue("0,5");
    assert.equal((await stored(page)).queue[0].submissionId, firstId);
    await fill(page); await page.getByRole("button", { name: "Проверить предварительно и сохранить отправку" }).click();
    await page.getByRole("button", { name: "Следующее", exact: true }).click(); await fill(page);
    await page.getByRole("button", { name: "Проверить предварительно и сохранить отправку" }).click();
    const originalIds = (await stored(page)).queue.map((q: any) => q.submissionId);
    await page.getByRole("button", { name: "К пакетам", exact: true }).click();
    await page.getByRole("button", { name: "Удалить пакет", exact: true }).click();
    await expect(page.locator("#notice")).toContainText("Пакет содержит несинхронизированные ответы");
    await page.getByRole("button", { name: "Открыть тренировку", exact: true }).click();
    await mkdir("tmp/offline-browser", { recursive: true });
    await page.screenshot({ path: "tmp/offline-browser/offline-practice.png", fullPage: true });
    console.log("PASS browser: full download, offline cold navigation, KaTeX, inputs, transitions, closed-tab draft recovery, pending symbolic checks, stable queue and protected deletion");
    // The server commits, but the browser receives no response. The queue must retain that ID.
    let dropped = false;
    await context.route("**/api/offline/sync", async route => {
      if (!dropped) { dropped = true; await route.fetch(); await route.abort("failed"); }
      else await route.continue();
    });
    await context.setOffline(false);
    await expect.poll(async () => prisma.userAttempt.count({ where: { userId: f.a.id, sessionId: pack.sessionId } })).toBe(1);
    assert.equal((await stored(page)).queue[0].receipt, undefined);
    await context.unroute("**/api/offline/sync");
    await prisma.practiceSession.update({ where: { id: pack.sessionId }, data: { revision: { increment: 1 } } });
    await page.getByRole("button", { name: "Синхронизировать", exact: true }).click();
    await expect(page.getByText(/Состояние изменилось на другом устройстве/)).toBeVisible();
    assert.deepEqual((await stored(page)).queue.map((q: any) => q.submissionId), originalIds);
    await page.getByRole("button", { name: "Принять текущую версию и отправить сохранённые ответы" }).click();
    await expect.poll(async () => (await stored(page)).queue.filter((q: any) => q.receipt).length, { timeout: 30000 }).toBe(3);
    assert.equal(await prisma.userAttempt.count({ where: { userId: f.a.id, sessionId: pack.sessionId } }), 3);
    assert.deepEqual((await stored(page)).queue.map((q: any) => q.submissionId), originalIds);
    await page.getByRole("button", { name: "Синхронизировать", exact: true }).click();
    assert.equal(await prisma.userAttempt.count({ where: { userId: f.a.id, sessionId: pack.sessionId } }), 3);
    console.log("PASS browser: lost server receipt retries the original ID; reconnection syncs three answers exactly once");
    // A new package update keeps the original answers, and a stale key stops the new queue.
    await page.getByRole("button", { name: "К пакетам", exact: true }).click();
    await page.getByRole("button", { name: "Скачать новую версию отдельно" }).click();
    await expect(page.getByRole("button", { name: "Открыть тренировку", exact: true })).toHaveCount(2, { timeout: 30000 });
    const updatedPack = (await stored(page)).packages.find((p: any) => p.id !== pack.id);
    await context.setOffline(true);
    await page.locator(`[data-package-id="${updatedPack.id}"]`).getByRole("button", { name: "Открыть тренировку", exact: true }).click();
    await fill(page); await page.getByRole("button", { name: "Проверить предварительно и сохранить отправку" }).click();
    const newId = (await stored(page)).queue.find((q: any) => q.packageId === updatedPack.id).submissionId;
    await prisma.questionStep.update({ where: { id: updatedPack.questions[0].steps[0].id }, data: { expectedAnswer: "0.75" } });
    await context.setOffline(false);
    await expect(page.getByText(/Версия контента изменилась/)).toBeVisible();
    assert.equal((await stored(page)).queue.find((q: any) => q.submissionId === newId).receipt, undefined);
    await page.getByRole("button", { name: "Принять текущую версию и отправить сохранённые ответы" }).click();
    await expect.poll(async () => (await stored(page)).queue.find((q: any) => q.submissionId === newId).receipt?.result.isCorrect).toBe(false);
    assert.equal((await stored(page)).queue.find((q: any) => q.submissionId === newId).receipt.result.stepResults[0].expectedAnswer, "0.75");
    console.log("PASS browser: update keeps old package, conflict retains IDs, stale content waits for explicit acceptance and server uses the updated key");
    // Expiration retains the previously authenticated scope and blocks upload.
    await context.clearCookies(); await page.reload();
    await expect(page.getByText("Требуется повторный вход в этот аккаунт. Работа сохранена на устройстве.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Открыть тренировку", exact: true }).first()).toBeVisible();
    await signIn(f.b);
    await expect(page.getByText("Пакетов пока нет.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Открыть тренировку", exact: true })).toHaveCount(0);
    await context.setOffline(true); await page.reload(); await expect(page.getByText("Пакетов пока нет.", { exact: true })).toBeVisible();
    await context.setOffline(false); await signIn(f.a);
    await expect(page.getByRole("button", { name: "Открыть тренировку", exact: true }).first()).toBeVisible();
    await context.setOffline(true); await page.getByRole("button", { name: "Закрыть офлайн-доступ и выйти" }).click();
    await expect(page.getByRole("button", { name: "Открыть тренировку", exact: true })).toHaveCount(0);
    await page.reload(); await expect(page.getByRole("button", { name: "Открыть тренировку", exact: true })).toHaveCount(0);
    assert.deepEqual(errors, []);
    console.log("PASS browser: expired auth retains work with a re-login state; another account and offline logout cannot display the original student's packages");
  } finally { await context.close(); await browser.close(); await f.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
