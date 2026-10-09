import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium, expect as baseExpect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { chromiumExecutable } from "./browser_test_support";
import { retiredPages } from "../lib/publicFeatures";

const base = process.env.EXAM_TEST_BASE_URL ?? "http://127.0.0.1:3100";
const output = "tmp/exam-ui", expect = baseExpect.configure({ timeout: 30000 }), prisma = new PrismaClient();
const email = `exam-ui-${randomUUID()}@example.test`, password = "exam-ui-password-123";
let userId: string | undefined;
async function fits(page: Page, label: string) {
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".katex-error")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth), { message: label }).toBeLessThanOrEqual(1);
  const links = await page.locator('a[href^="/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("href")!));
  assert.ok(links.every(href => !retiredPages.some(root => href.split(/[?#]/)[0] === root || href.startsWith(root + "/"))), label + ": archived links");
  const body = await page.locator("body").innerText();
  assert.ok(!/Mastery|Streak|Персональная программа|План дня|Покрытие экзамена|Купить|150 тг/.test(body), label + ": retired copy or false payment controls");
}
async function save(page: Page, action: () => Promise<unknown>, id: string) {
  const response = page.waitForResponse(r => r.url().endsWith(`/api/exams/${id}`) && r.request().method() === "PATCH");
  const [saved] = await Promise.all([response, action()]);
  assert.equal(saved.status(), 200);
  await expect(page.getByText("Изменения сохранены", { exact: false })).toBeVisible();
}
async function main() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: await chromiumExecutable() });
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  // tsx/esbuild's named-function helper is required for serialized evaluate callbacks.
  await context.addInitScript("globalThis.__name = fn => fn;");
  const page = await context.newPage(), runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  try {
    await page.goto(base);
    await expect(page).toHaveURL(`${base}/login`);
    await fits(page, "login 360");
    await page.getByRole("tab", { name: "Регистрация", exact: true }).click();
    await page.locator("#page-reg-name").fill("Exam UI student");
    await page.locator("#page-reg-email").fill(email);
    await page.locator("#page-reg-password").fill(password);
    const registered = page.waitForResponse(r => r.url().endsWith("/api/auth/register") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Зарегистрироваться", exact: true }).click();
    const registration = await registered;
    assert.equal(registration.status(), 200); userId = (await registration.json()).user.id;
    await expect(page).toHaveURL(base + "/");
    await expect(page.getByRole("button", { name: "Начать пробник", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "English", exact: true })).toHaveCount(0);
    await expect(page.getByText("ЕНТ ТиПО · B057 · сокращённый срок обучения", { exact: true })).toBeVisible();
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await fits(page, `start ${width}`);
      await page.screenshot({ path: `${output}/start-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 360, height: 800 });
    const started = page.waitForResponse(r => r.url().endsWith("/api/exams") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Начать пробник", exact: true }).click();
    const paper = await (await started).json(), id = paper.id;
    assert.equal(paper.questions.length, 20);
    for (const key of ["correctIndex", "explanation", "hint", "correctAnswer"]) assert.ok(!JSON.stringify(paper).includes(`"${key}"`));
    await expect(page).toHaveURL(`${base}/exam/${id}`);
    await expect(page.getByRole("timer")).toHaveText(/^\d\d:\d\d$/);
    await fits(page, "active 360");
    await save(page, () => page.getByRole("radio").nth(0).locator("..").click(), id);
    await save(page, () => page.getByRole("radio").nth(1).locator("..").click(), id);
    // The server saves an answer but the response is lost. Reload must recover and safely retry it.
    let dropped = false;
    await page.route(`**/api/exams/${id}`, async route => {
      if (route.request().method() === "PATCH" && !dropped) { dropped = true; await route.fetch(); await route.abort("failed"); }
      else await route.continue();
    });
    await page.getByRole("radio").nth(2).locator("..").click();
    await expect(page.getByRole("button", { name: "Повторить запрос", exact: true })).toBeVisible();
    await page.unroute(`**/api/exams/${id}`);
    await page.reload();
    await expect(page.getByText("Есть неподтверждённое сохранение.", { exact: false })).toBeVisible();
    await save(page, () => page.getByRole("button", { name: "Повторить запрос", exact: true }).click(), id);
    await expect(page.getByRole("radio").nth(2)).toBeChecked();
    await save(page, () => page.getByRole("button", { name: "Вернуться позже", exact: true }).click(), id);
    await save(page, () => page.getByRole("button", { name: "Задание 2", exact: true }).click(), id);
    await page.screenshot({ path: `${output}/active-360.png`, fullPage: true });
    await page.goto(`${base}/account`);
    await fits(page, "account 360");
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page).toHaveURL(`${base}/login`);
    await page.locator("#page-login-email").fill(email);
    await page.locator("#page-login-password").fill(password);
    await page.getByRole("button", { name: "Войти в кабинет", exact: true }).click();
    await expect(page).toHaveURL(base + "/");
    await page.getByRole("link", { name: "Продолжить пробник", exact: true }).click();
    await expect(page).toHaveURL(`${base}/exam/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Задание 2/);
    await save(page, () => page.getByRole("button", { name: "Задание 1, вернуться позже", exact: true }).click(), id);
    await expect(page.getByRole("radio").nth(2)).toBeChecked();
    await expect(page.getByRole("button", { name: "Снять отметку", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Завершить пробник", exact: true }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
    assert.ok(await dialog.evaluate(node => { const box = node.getBoundingClientRect(); return box.left >= 8 && box.right <= innerWidth - 8 && box.bottom <= innerHeight; }));
    await dialog.getByRole("button", { name: "Подтвердить завершение", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Результат:/);
    await expect(page.getByText("Пропуски:", { exact: false })).toBeVisible();
    await expect(page.locator("details")).toHaveCount(20);
    await page.locator("summary").first().click();
    await expect(page.locator("details").first().getByText("Правильный ответ:", { exact: false })).toBeVisible();
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await fits(page, `result ${width}`);
      await page.screenshot({ path: `${output}/result-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/results`);
    await expect(page.locator(`a[href="/exam/${id}"]`)).toBeVisible();
    await fits(page, "history 390"); await page.screenshot({ path: `${output}/history-390.png`, fullPage: true });
    await page.locator(`a[href="/exam/${id}"]`).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Результат:/);
    // A new attempt remains available: there is no fake free-attempt/payment limit.
    await page.goto(base);
    await page.getByRole("button", { name: "Қазақша", exact: true }).click();
    await expect(page.getByRole("button", { name: "Сынақты бастау", exact: true })).toBeEnabled();
    const kkStarted = page.waitForResponse(r => r.url().endsWith("/api/exams") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Сынақты бастау", exact: true }).click();
    const kkPaper = await (await kkStarted).json(); assert.equal(kkPaper.language, "kk"); assert.equal(kkPaper.questions.length, 20);
    await expect(page).toHaveURL(`${base}/exam/${kkPaper.id}`); await expect(page.getByRole("timer")).toBeVisible(); await fits(page, "Kazakh active 390");
    await page.screenshot({ path: `${output}/kazakh-active-390.png`, fullPage: true });
    // The visible page finalizes an expired server deadline on its own polling loop.
    await prisma.examSession.update({ where: { id: kkPaper.id, userId }, data: { startedAt: new Date(Date.now() - 41 * 60000), deadlineAt: new Date(Date.now() - 60000) } });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/0\/20/, { timeout: 20000 });
    const finished = await prisma.examSession.findUniqueOrThrow({ where: { id: kkPaper.id, userId } });
    assert.equal(finished.status, "completed");
    const result = finished.result as { completionReason: string; skipped: number };
    assert.equal(result.completionReason, "timeout"); assert.equal(result.skipped, 20);
    await fits(page, "Kazakh timeout 390");
    await page.goto(`${base}/results`); await fits(page, "Kazakh history 390");
    await page.goto(`${base}/account`); await fits(page, "Kazakh account 390");
    assert.deepEqual(runtimeErrors, [], "Browser runtime errors");
    console.log("PASS: browser registration/login/logout, RU/KK papers, changed answers, lost-response recovery, flags, resume, finish/review/history, automatic timeout; 360/390/768/1440 layouts.");
  } catch (error) {
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (userId && await prisma.user.findFirst({ where: { id: userId, email } })) {
    await prisma.$transaction(async tx => {
      await tx.mistake.deleteMany({ where: { userId } });
      await tx.userStepAnswer.deleteMany({ where: { attempt: { userId } } });
      await tx.userAttempt.deleteMany({ where: { userId } });
      await tx.practiceSession.deleteMany({ where: { userId } });
      await tx.userTopicProgress.deleteMany({ where: { userId } });
      await tx.dailyGoal.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId, email } });
    });
  }
  await prisma.$disconnect();
});
