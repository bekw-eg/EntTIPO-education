import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { access, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { baseUrl, prisma } from "./choice_test_fixture";
import { roadFixture, road } from "./road_test_fixture";
import { parseChoice } from "../lib/practiceChoice";

async function executable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (process.platform !== "win32") return undefined;
  const root = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  for (const name of (await readdir(root)).filter(item => item.startsWith("chromium-")).reverse()) {
    for (const folder of ["chrome-win64", "chrome-win"]) {
      const file = path.join(root, name, folder, "chrome.exe"); try { await access(file); return file; } catch {}
    }
  }
}
async function main() {
  const fixture = await roadFixture(), browser = await chromium.launch({ headless: true, executablePath: await executable() });
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  context.setDefaultTimeout(30000);
  await context.addInitScript("globalThis.__name = (fn) => fn;");
  const origin = new URL(baseUrl), separator = fixture.a.cookie.indexOf("=");
  await context.addCookies([{ name: fixture.a.cookie.slice(0, separator), value: fixture.a.cookie.slice(separator + 1),
    domain: origin.hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage(), errors: string[] = [];
  await mkdir("tmp/learning-road", { recursive: true });
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(`${baseUrl}/learning-road`);
    const initial = await road(fixture.a.cookie);
    await expect(page.getByRole("heading", { name: "Мой путь", exact: true })).toBeVisible();
    await expect(page.locator("[data-road-node]")).toHaveCount(initial.nodes.length, { timeout: 30000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await mkdir("tmp/learning-road", { recursive: true });
    await page.screenshot({ path: "tmp/learning-road/mobile-ru.png", fullPage: true, animations: "disabled" });
    const buttons = page.locator("[data-road-node]");
    await buttons.nth(0).focus(); await page.keyboard.press("ArrowDown"); await expect(buttons.nth(1)).toBeFocused();
    await page.keyboard.press("Enter"); await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Почему предложено?", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(buttons.nth(1)).toBeFocused();
    await buttons.nth(0).click(); await page.getByRole("button", { name: "Начать", exact: true }).click();
    await expect(page).toHaveURL(/\/learn\/rules\/.+\?roadNodeId=/);
    await page.getByRole("button", { name: "Я прочитал правило", exact: true }).click();
    await expect(page).toHaveURL(/\/learning-road$/);
    await expect(page.locator("[data-road-node][aria-current=step]")).toHaveCount(1);
    await expect(page.getByText(`Прогресс блока: 1 / ${initial.nodes.length}`, { exact: true })).toBeVisible();
    // Dialog and language switching preserve the same lesson selection and saved block.
    await page.getByTitle("Қазақша", { exact: true }).last().click();
    await expect(page.getByRole("heading", { name: "Менің оқу жолым", exact: true })).toBeVisible();
    await page.screenshot({ path: "tmp/learning-road/mobile-kk.png", fullPage: true, animations: "disabled" });
    await page.locator("[data-road-node][aria-current=step]").click();
    await expect(page.getByText("Неге ұсынылды?", { exact: true })).toBeVisible();
    await page.screenshot({ path: "tmp/learning-road/details-kk.png", fullPage: true, animations: "disabled" });
    await page.keyboard.press("Escape");
    await page.getByTitle("English", { exact: true }).last().click();
    await expect(page.getByRole("heading", { name: "Learning Road", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Learning Road", exact: true })).toBeVisible();
    assert.equal((await road(fixture.a.cookie)).id, initial.id);
    await page.getByTitle("Русский", { exact: true }).last().click();
    await page.locator("[data-road-node][aria-current=step]").click();
    await page.getByRole("button", { name: "Начать", exact: true }).click();
    await expect(page).toHaveURL(/\/practice\/session\//);
    await expect(page.getByRole("radio")).toHaveCount(5);
    const sessionId = page.url().split("/").at(-1)!;
    const session = await prisma.practiceSession.findUniqueOrThrow({ where: { id: sessionId } });
    for (let index = 0; index < session.questionIds.length; index++) {
      const id = session.questionIds[index], question = await prisma.question.findUniqueOrThrow({ where: { id } });
      await page.locator(`input[value="${parseChoice(question.practiceChoice).correctOptionIds[0]}"]`).check();
      await page.getByRole("button", { name: "Проверить", exact: true }).click();
      await page.getByRole("button", { name: index + 1 === session.questionIds.length ? "Завершить тренировку" : "Следующее задание", exact: true }).click();
    }
    await expect(page.getByRole("link", { name: "Продолжить путь", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Продолжить путь", exact: true }).click();
    await expect(page.getByText(`Прогресс блока: 2 / ${initial.nodes.length}`, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "Переключить тему оформления", exact: true }).click();
    await page.screenshot({ path: "tmp/learning-road/desktop-dark.png", fullPage: true, animations: "disabled" });
    await page.goto(baseUrl);
    await expect(page.getByRole("heading", { name: "Мой путь", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Продолжить путь", exact: true })).toBeVisible();
    assert.deepEqual(errors, []);
    console.log("PASS: 360px/desktop, RU/KK/EN, keyboard/escape/focus, stable reload, theory, existing five-choice practice, completed node and dashboard card; screenshots in tmp/learning-road");
  } catch (error) {
    await page.screenshot({ path: "tmp/learning-road/failure.png", fullPage: true, animations: "disabled" });
    console.error("Browser state:", await page.locator("body").innerText(), "Page errors:", errors);
    throw error;
  } finally { await browser.close(); await fixture.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
