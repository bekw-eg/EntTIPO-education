import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect, type Page } from "@playwright/test";
import { chromiumExecutable } from "./browser_test_support";
import { api, baseUrl, prisma } from "./choice_test_fixture";
import { preparationFixture, preparation, finishDiagnostic } from "./preparation_test_fixture";
import type { PaperQuestion } from "../lib/exam/mode";
import { parseChoice } from "../lib/practiceChoice";

const widths = [360, 390, 768, 1440], output = "tmp/preparation/browser";
async function capture(page: Page, label: string) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator(".katex-error")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${output}/${label}-${width}.png`, fullPage: true, animations: "disabled" });
  }
}
async function answerAssessment(page: Page, wrong = false, skip = false) {
  await expect(page).toHaveURL(/\/exam\/.+/);
  const id = page.url().split("/").at(-1)!;
  const exam = await prisma.examSession.findUniqueOrThrow({ where: { id } });
  const paper = exam.paper as unknown as PaperQuestion[];
  if (!skip) for (const [index, q] of paper.entries()) {
    await expect(page.getByRole("radio")).toHaveCount(q.options.length);
    const answer = wrong ? (q.correctIndex + 1) % q.options.length : q.correctIndex;
    await page.getByRole("radio").nth(answer).click();
    await expect(page.getByRole("radio").nth(answer)).toBeChecked();
    if (index + 1 < paper.length) {
      await page.getByRole("button", { name: "Далее", exact: true }).click();
      await expect(page.locator("h1")).toContainText(`Задание ${index + 2} `);
    }
  }
  await page.getByRole("button", { name: "Завершить экзамен", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить завершение", exact: true }).click();
  await expect(page.getByTestId("preparation-result")).toBeVisible();
  return id;
}
async function main() {
  const f = await preparationFixture(), browser = await chromium.launch({ headless: true, executablePath: await chromiumExecutable() });
  const errors: string[] = [], context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: "block" });
  context.setDefaultTimeout(30000);
  await context.addInitScript("globalThis.__name = (fn) => fn;");
  async function login(cookie: string) {
    await context.clearCookies(); const split = cookie.indexOf("=");
    await context.addCookies([{ name: cookie.slice(0, split), value: cookie.slice(split + 1), domain: new URL(baseUrl).hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  }
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", e => { if (e.type() === "error") errors.push(e.text()); });
  page.on("response", r => { if (r.status() >= 500 || r.status() === 404) errors.push(`${r.status()} ${r.url()}`); });
  await mkdir(output, { recursive: true });
  try {
    await login(f.b.cookie); await page.goto(baseUrl);
    await expect(page.getByTestId("preparation-stage")).toHaveText("Начните с оценки знаний");
    await capture(page, "entrance");
    await page.getByRole("link", { name: "Пройти диагностику", exact: true }).click();
    await page.getByRole("button", { name: "Начать входную диагностику", exact: true }).click();
    await expect(page.getByRole("button", { name: "Сохранить и продолжить", exact: true })).toBeVisible();
    const diagnostic = (await api("/api/diagnostics", f.b.cookie)).data[0];
    const before = (await api(`/api/diagnostics/${diagnostic.id}`, f.b.cookie)).data;
    await page.locator('main input[type="text"]').first().fill("x^5");
    await page.reload(); await expect(page.locator('main input[type="text"]').first()).toHaveValue("x^5");
    assert.equal((await api(`/api/diagnostics/${diagnostic.id}`, f.b.cookie)).data.id, before.id);
    await capture(page, "diagnostic");
    await page.goto(baseUrl); await expect(page.getByTestId("preparation-stage")).toHaveText("Диагностика не завершена");
    await finishDiagnostic(f.b.cookie);
    await page.goto(baseUrl + "/diagnostics");
    await expect(page.getByRole("link", { name: "Начать подготовку", exact: true })).toBeVisible();
    await capture(page, "diagnostic-report");
    await page.getByRole("link", { name: "Начать подготовку", exact: true }).click();
    await expect(page.getByTestId("preparation-node-SKILL").first()).toBeVisible();
    const planId = (await preparation(f.b.cookie)).id;
    await page.reload(); assert.equal((await preparation(f.b.cookie)).id, planId);
    await capture(page, "real-bank-road");

    await f.cycle(); await login(f.a.cookie); await page.goto(baseUrl + "/learning-road");
    await expect(page.getByTestId("preparation-node-SKILL")).toHaveCount(3);
    await page.getByRole("button", { name: "Начать контрольную проверку", exact: true }).click();
    await expect(page.getByRole("radio")).toHaveCount(5);
    const checkUrl = page.url(); await page.getByRole("radio").last().click();
    await expect(page.getByRole("radio").last()).toBeChecked(); await page.reload();
    await expect(page.getByRole("radio").last()).toBeChecked(); assert.equal(page.url(), checkUrl);
    await capture(page, "active-check");
    await answerAssessment(page, true);
    await page.getByTestId("preparation-result").getByRole("link", { name: "Открыть дорожную карту", exact: true }).click();
    await expect(page.getByRole("button", { name: "Перейти к закреплению", exact: true })).toBeVisible();
    await capture(page, "repair");
    await page.getByRole("button", { name: "Перейти к закреплению", exact: true }).click();
    await expect(page).toHaveURL(/\/practice\/session\//);
    const sessionId = page.url().split("/").at(-1)!;
    const session = await prisma.practiceSession.findUniqueOrThrow({ where: { id: sessionId } });
    for (const [i, qid] of session.questionIds.entries()) {
      const q = await prisma.question.findUniqueOrThrow({ where: { id: qid } });
      await page.locator(`input[value="${parseChoice(q.practiceChoice).correctOptionIds[0]}"]`).check();
      await page.getByRole("button", { name: "Проверить", exact: true }).click();
      await page.getByRole("button", { name: i + 1 === session.questionIds.length ? "Завершить тренировку" : "Следующее задание", exact: true }).click();
    }
    await page.getByRole("link", { name: "Продолжить путь", exact: true }).click();
    for (let step = 0; step < 4; step++) {
      await page.getByRole("button", { name: "Начать контрольную проверку", exact: true }).click();
      await answerAssessment(page);
      await page.getByTestId("preparation-result").getByRole("link", { name: "Открыть дорожную карту", exact: true }).click();
    }
    await expect(page.getByTestId("preparation-stage")).toHaveText("Доступен финальный экзамен");
    await capture(page, "final-ready");
    await page.getByRole("button", { name: "Начать контрольную проверку", exact: true }).click();
    await expect(page.getByRole("radio")).toHaveCount(4);
    const finalId = await answerAssessment(page, false, true);
    await capture(page, "final-result");
    await page.getByTestId("preparation-result").getByRole("link", { name: "Открыть дорожную карту", exact: true }).click();
    await expect(page.getByTestId("preparation-stage")).toHaveText("Закрепление после финального экзамена");
    const renewed = await preparation(f.a.cookie); assert.ok(renewed.history.some(c => c.sourceExamId === finalId));
    await capture(page, "next-cycle");
    await page.getByTitle("Қазақша", { exact: true }).click(); await expect(page.locator("h1")).toHaveText("Менің дайындық бағдарламам");
    await page.getByTitle("English", { exact: true }).click(); await expect(page.locator("h1")).toHaveText("My preparation programme");
    await page.reload(); await expect(page.locator("h1")).toHaveText("My preparation programme");
    assert.deepEqual(errors, []);
    await writeFile(`${output}/report.json`, JSON.stringify({ widths, errors, scenarios: ["diagnostic recovery", "real bank road", "failed check", "practice", "independent recheck", "mixed check", "final", "reinforcement", "RU/KK/EN"] }, null, 2));
    console.log("PASS production browser: full preparation cycle, saved diagnostics and exam answers, 360/390/768/1440px, RU/KK/EN, KaTeX, no console/runtime/HTTP errors.");
  } catch (e) {
    console.error("Formula errors:", await page.locator(".katex-error").evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, title: n.getAttribute("title") }))));
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true }); console.error("Browser:", page.url(), (await page.locator("body").innerText()).slice(0, 6500), errors); throw e;
  }
  finally { await browser.close(); await f.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
