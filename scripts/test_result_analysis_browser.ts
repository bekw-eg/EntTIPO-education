import assert from "node:assert/strict";
import { chromium, expect, type Page } from "@playwright/test";
import { access, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { api, baseUrl, choiceFixture, prisma } from "./choice_test_fixture";
import { parseChoice } from "../lib/practiceChoice";
import { analysisText } from "../lib/i18n/result-analysis";

async function executable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (process.platform !== "win32") return undefined;
  const root = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  for (const name of (await readdir(root)).filter(n => n.startsWith("chromium-")).reverse()) {
    for (const folder of ["chrome-win64", "chrome-win"]) {
      const file = path.join(root, name, folder, "chrome.exe"); try { await access(file); return file; } catch {}
    }
  }
}
async function fits(page: Page) {
  await expect(page.locator("[data-result-analysis]")).toBeVisible();
  await expect(page.locator("[data-result-analysis] .katex").first()).toBeVisible();
  await expect(page.locator(".katex-error")).toHaveCount(0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "No page-level horizontal overflow");
  const targets = await page.locator("[data-retry-card] button").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  assert.ok(targets.every(height => height >= 44));
}
async function main() {
  const fixture = await choiceFixture();
  const browser = await chromium.launch({ headless: true, executablePath: await executable() });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  await context.addInitScript("globalThis.__name = (fn) => fn;");
  const origin = new URL(baseUrl), separator = fixture.a.cookie.indexOf("=");
  await context.addCookies([{ name: fixture.a.cookie.slice(0, separator), value: fixture.a.cookie.slice(separator + 1),
    domain: origin.hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage(), errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await mkdir("tmp/result-analysis", { recursive: true });
  try {
    // A long authored equivalent of 7 exercises both the stem and answer overflow.
    const row = await prisma.question.findUniqueOrThrow({ where: { id: fixture.q(2) } });
    const choice = parseChoice(row.practiceChoice), terms = `7+${"x-x+".repeat(60)}0`, long = `sqrt((${terms})^2)`;
    await prisma.topic.update({ where: { id: fixture.topic.id }, data: { name: "Корни и степени", nameKk: "Түбірлер мен дәрежелер" } });
    await prisma.question.update({ where: { id: row.id }, data: { practiceChoice: { ...choice,
      questionText: `Упрости: $\\sqrt{(${terms})^2}$.`, questionTextKk: `$\\sqrt{(${terms})^2}$ өрнегін ықшамда.`,
      explanation: "Одинаковые слагаемые сокращаются. Квадратный корень из квадрата положительного числа 7 равен 7.",
      explanationKk: "Бірдей мүшелер қысқарады. Оң 7 санының квадратының квадрат түбірі 7-ге тең.",
      options: choice.options.map((option, index) => index === 0 ? { ...option, text: long, textKk: long } : option),
      solutionSteps: [{ prompt: "Сократи одинаковые слагаемые", promptKk: "Бірдей мүшелерді қысқарт", answer: `${long}=7` }],
    } as unknown as Prisma.InputJsonValue } });
    const session = await fixture.session(fixture.a.id, [fixture.q(0), fixture.q(1), fixture.q(2)]);
    const url = `${baseUrl}/practice/session/${session.id}`;
    await page.goto(url);
    await page.locator(`input[value="${fixture.q(0)}-2"]`).check();
    await page.getByRole("button", { name: "Проверить", exact: true }).click();
    await expect(page.locator("[data-mistake-card]")).toHaveCount(1);
    await expect(page.getByText(analysisText.ru.unclassified, { exact: true })).toHaveCount(1);
    await fits(page);
    assert.ok(await page.locator("[data-result-analysis]").evaluate(node => node.getBoundingClientRect().width) <= 672);
    await page.screenshot({ path: "tmp/result-analysis/desktop-ru.png", fullPage: true });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByTitle("Қазақша", { exact: true }).last().click();
    await expect(page.getByText("Сенің жауабың", { exact: true })).toBeVisible();
    await expect(page.getByText(analysisText.kk.unclassified, { exact: true })).toHaveCount(1);
    await fits(page);
    await page.screenshot({ path: "tmp/result-analysis/mobile-kk.png", fullPage: true });
    await page.getByTitle("Русский", { exact: true }).last().click();
    await page.getByRole("button", { name: "Следующее задание", exact: true }).click();
    await page.locator(`input[value="${fixture.q(1)}-1"]`).check();
    await page.getByRole("button", { name: "Проверить", exact: true }).click();
    await expect(page.getByText("Выполнено вычитание вместо сложения.", { exact: true })).toHaveCount(1);
    await expect(page.getByText(analysisText.ru.unclassified, { exact: true })).toHaveCount(0);
    const retry = page.getByRole("button", { name: "Решить задание", exact: false });
    await retry.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("radio")).toHaveCount(5);
    await page.locator(`input[value="${fixture.q(1)}-0"]`).check();
    await page.getByRole("button", { name: "Проверить", exact: true }).click();
    await expect(page.getByText(analysisText.ru.correct, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Следующее задание", exact: true }).click();
    await page.locator(`input[value="${fixture.q(2)}-0"]`).check();
    await page.getByRole("button", { name: "Проверить", exact: true }).click();
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 }); await fits(page);
      assert.ok(await page.locator("[data-mistake-card] div").evaluateAll(nodes => nodes.some(node =>
        getComputedStyle(node).overflowX === "auto" && node.scrollWidth > node.clientWidth)), "Long formula has a local scroll container");
      await page.screenshot({ path: `tmp/result-analysis/long-${width}.png`, fullPage: true });
    }
    await page.reload(); await expect(page.getByText(analysisText.ru.correct, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
    await page.getByRole("button", { name: "Просмотреть историю ответов", exact: true }).click();
    await expect(page.locator("details")).toHaveCount(4);
    assert.equal(await prisma.userAttempt.count({ where: { sessionId: session.id } }), 4);

    const multi = await fixture.session(fixture.a.id, [fixture.q(21), ...Array.from({ length: 19 }, (_, i) => fixture.q(i))]);
    await page.goto(`${baseUrl}/practice/session/${multi.id}`);
    await page.locator(`input[value="${fixture.q(21)}-0"]`).check();
    await page.locator(`input[value="${fixture.q(21)}-1"]`).check();
    await page.getByRole("button", { name: "Проверить", exact: true }).click();
    await expect(page.locator("[data-mistake-card] ul").nth(0).locator("li")).toHaveCount(2);
    await expect(page.locator("[data-mistake-card] ul").nth(1).locator("li")).toHaveCount(2);
    await page.getByTitle("English", { exact: true }).last().click();
    await expect(page.getByText(analysisText.en.correct, { exact: true })).toBeVisible();
    await expect(page.getByText("Correct answer", { exact: true })).toBeVisible();
    await fits(page);

    // Render a historical multi-step response using the public snapshot contract.
    // Only this read is mocked; submissions/retry/cursor/history above use the real API.
    const snapshot = (await api(`/api/sessions/${multi.id}`, fixture.a.cookie)).data;
    snapshot.question = { ...snapshot.question, questionText: "Найди производную: (3*x+1)^2",
      questionTextKk: "Туындысын тап: (3*x+1)^2", latex: null,
      steps: [1, 2, 3].map(order => ({ id: `legacy-${order}`, order, type: "expression_input",
        prompt: "Запиши ответ", promptKk: "Жауабыңды жаз", options: [] })) };
    snapshot.result = { ...snapshot.result, choice: undefined, isCorrect: false, isPartial: false, score: 0,
      errorType: "concept_error", explanation: "Внешняя производная: 2(3x+1). Внутренняя: 3. Умножаем: 6(3x+1).",
      explanationKk: "Сыртқы туынды: 2(3x+1). Ішкі туынды: 3. Көбейтеміз: 6(3x+1).",
      stepResults: [1, 2, 3].map(order => ({ stepId: `legacy-${order}`, stepOrder: order, isCorrect: false,
        userAnswer: "2*(3*x+1)", expectedAnswer: "6*(3*x+1)", skillIds: ["chain_rule"],
        feedback: { ru: "По этому ответу нельзя точно определить причину; повтори правило.",
          kk: "Бұл жауаптан қатенің себебін нақты анықтау мүмкін емес; ережені қайтала." } })) };
    await page.route(`**/api/sessions/${multi.id}`, route => route.fulfill({ json: snapshot }));
    await page.reload();
    await page.getByTitle("Қазақша", { exact: true }).last().click();
    await expect(page.locator("[data-mistake-card]")).toHaveCount(3);
    await expect(page.getByText(analysisText.kk.unclassified, { exact: true })).toHaveCount(1);
    await expect(page.getByText("Нені есте сақтау керек", { exact: true })).toBeVisible();
    await fits(page);
    await page.screenshot({ path: "tmp/result-analysis/legacy-rules-kk.png", fullPage: true });
    await page.getByTitle("Русский", { exact: true }).last().click(); await fits(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: "tmp/result-analysis/legacy-rules-ru.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log("PASS: single/multiple errors, authored/unclassified causes, KaTeX/long formula, correct/multi-select, 360/390px, desktop, RU/KK/EN, keyboard retry, saved result/reload, next/finish and history");
  } catch (error) {
    await page.screenshot({ path: "tmp/result-analysis/failure.png", fullPage: true });
    throw error;
  } finally { await browser.close(); await fixture.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
