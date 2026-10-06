import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect as baseExpect, type Page } from "@playwright/test";
import { api, baseUrl, choiceFixture, prisma } from "./choice_test_fixture";
import { chromiumExecutable } from "./browser_test_support";
import { TIPO_MATH } from "../lib/exam/profile";
import { interfaceText } from "../lib/i18n/interface";

const output = process.env.SMOKE_OUTPUT_DIR ?? "tmp/ui-smoke";
const expect = baseExpect.configure({ timeout: 30000 });
const widths = [360, 390, 768, 1440];
const staticProtected = ["/", "/practice", "/diagnostics", "/statistics", "/learning-road", "/topics", "/mistakes", "/geometry", "/exam", "/exam-coverage"];
const dynamicPatterns = ["/topics/[topicId]", "/learn/rules/[skillId]", "/practice/session/[sessionId]", "/exam/[examId]"];
const results: string[] = [];
async function routeInventory(folder = "app", segments: string[] = []): Promise<string[]> {
  const routes: string[] = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "api") routes.push(...await routeInventory(path.join(folder, entry.name), entry.name.startsWith("(") ? segments : [...segments, entry.name]));
    if (entry.isFile() && entry.name === "page.tsx") routes.push("/" + segments.join("/"));
  }
  return routes.sort();
}

async function fits(page: Page, label: string) {
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".katex-error")).toHaveCount(0);
  // Responsive charts measure their parent with ResizeObserver after viewport changes.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth), { message: `${label}: page overflow` }).toBeLessThanOrEqual(1);
  for (const dialog of await page.getByRole("dialog").all()) {
    await expect.poll(() => dialog.evaluate(node => {
      const box = node.getBoundingClientRect();
      return box.left >= 8 && box.right <= innerWidth - 8 && box.top >= 0 && box.bottom <= innerHeight;
    }), { message: `${label}: dialog fits viewport` }).toBe(true);
  }
  // Catch unnamed controls and unlabeled form fields without imposing a full accessibility framework.
  const unnamed = await page.locator('button, input:not([type="hidden"]), select').evaluateAll(nodes => nodes.filter(node => {
    if (!(node instanceof HTMLElement) || !node.getClientRects().length) return false;
    const labelled = node.getAttribute("aria-label") || node.getAttribute("aria-labelledby") || node.getAttribute("title") || node.textContent?.trim();
    const labels = (node as HTMLInputElement).labels;
    return !labelled && !labels?.length;
  }).map(node => node.outerHTML.slice(0,200)));
  assert.deepEqual(unnamed, [], `${label}: accessible names`);
}

async function main() {
  assert.deepEqual(await routeInventory(), ["/login", ...staticProtected, ...dynamicPatterns].sort(), "Update the smoke inventory when adding a page");
  const f = await choiceFixture();
  const browser = await chromium.launch({ headless: true, executablePath: await chromiumExecutable() });
  const errors: string[] = [];
  let expectedFailure = false;
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block", colorScheme: "light" });
  context.setDefaultTimeout(45000);
  await context.addInitScript("globalThis.__name = fn => fn;");
  const page = await context.newPage();
  page.on("pageerror", error => { const message = `runtime (${page.url()}): ${error.message}`; errors.push(message); console.error(message); });
  page.on("console", message => {
    if (message.type() === "error") {
      // Fault-injection scenarios intentionally receive one resource error. Application exceptions still fail.
      if (expectedFailure && /^Failed to load resource: the server responded with a status of 503/.test(message.text())) return;
      errors.push(`console: ${message.text()} (${message.location().url})`);
    }
  });
  page.on("response", response => {
    if ((response.status() === 404 || response.status() >= 500) && !(expectedFailure && response.status() === 503)) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  async function visit(route: string, ready?: () => Promise<unknown>) {
    const response = await page.goto(baseUrl + route);
    assert.ok(response && response.status() < 400, `${route}: ${response?.status()}`);
    await expect(page.locator("h1")).toBeVisible();
    if (ready) await ready();
    await page.evaluate(() => document.fonts.ready);
  }
  async function capture(label: string) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await fits(page, `${label} ${width}`);
      await page.screenshot({ path: `${output}/${label}-${width}.png`, fullPage: true, animations: "disabled" });
    }
    assert.deepEqual(errors, [], label);
    console.log(`PASS visual ${label}: ${widths.join(", ")}`);
  }
  try {
    await prisma.topic.update({ where: { id: f.topic.id }, data: { name: "Сложение и проверка ответа", nameKk: "Қосу және жауапты тексеру", description: "Учебная проверка операций", descriptionKk: "Амалдарды тексеру" } });
    const session = await f.session(f.a.id, [f.q(0), f.q(1)]);
    const dynamicRoutes = [`/topics/${f.topic.id}`, `/learn/rules/${f.skill.id}`, `/practice/session/${session.id}`];
    // Every protected page must send guests to login; no auth bypass or mocked identity.
    for (const route of [...staticProtected, ...dynamicRoutes]) {
      await page.goto(baseUrl + route); await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
      console.log(`PASS guest redirect ${route}`);
    }
    await visit("/login"); await capture("login");
    await page.getByRole("tab", { name: "Регистрация", exact: true }).click();
    await expect(page.getByLabel("Имя и фамилия")).toBeVisible(); await fits(page, "registration tab");
    await page.getByRole("tab", { name: "Вход", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(f.a.email);
    await page.getByLabel("Пароль", { exact: true }).fill("choice-password-123");
    await page.getByRole("button", { name: "Войти в кабинет", exact: true }).click();
    await expect(page).toHaveURL(baseUrl + "/"); results.push("PASS /login (login + registration form + protected redirects)");
    await page.setViewportSize({ width: 360, height: 844 });
    await page.getByRole("button", { name: "Меню аккаунта", exact: true }).click();
    await page.getByRole("menuitem", { name: "Новый ученик (Регистрация)", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible(); await fits(page, "account dialog");
    await page.screenshot({ path: `${output}/account-dialog.png`, animations: "disabled" });
    await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
    results.push("PASS account menu and registration dialog (keyboard + 360px)");
    for (const route of staticProtected) {
      const loaded = route === "/" ? () => expect(page.getByRole("button", { name: "Начать", exact: true }).first()).toBeVisible()
        : route === "/learning-road" ? () => expect(page.locator("[data-road-node]").first()).toBeVisible()
        : route === "/practice" ? () => expect(page.getByRole("radio").first()).toBeVisible()
        : route === "/statistics" ? () => expect(page.getByText(interfaceText.ru.emptyProgress, { exact: true })).toBeVisible()
        : route === "/diagnostics" ? () => expect(page.getByRole("button", { name: "Начать входную диагностику", exact: true })).toBeVisible()
        : route === "/mistakes" ? () => expect(page.getByText("Ошибок не найдено", { exact: true })).toBeVisible()
        : undefined;
      await visit(route, loaded); await capture(route === "/" ? "dashboard" : route.slice(1)); results.push(`PASS ${route}`);
    }
    for (const route of dynamicRoutes) {
      await visit(route, route.includes("/session/") ? () => expect(page.getByRole("radio")).toHaveCount(5) : undefined);
      await capture(route.includes("/session/") ? "question" : route.includes("/rules/") ? "rule" : "topic");
      results.push(`PASS ${route.replace(f.skill.id,"[skillId]").replace(f.topic.id,"[topicId]").replace(session.id,"[sessionId]")}`);
    }
    await page.locator(`input[value="${f.q(0)}-1"]`).check();
    await page.getByRole("button", { name: "Проверить", exact: true }).click();
    await expect(page.locator("[data-result-analysis]")).toBeVisible(); await capture("result-analysis");
    await page.reload(); await expect(page.locator("[data-result-analysis]")).toBeVisible();
    expectedFailure = true;
    const sessionEndpoint = `**/api/sessions/${session.id}`;
    await page.route(sessionEndpoint, route => route.fulfill({ status: 503, json: { error: "Smoke result unavailable" } }));
    await page.reload(); await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await page.unroute(sessionEndpoint);
    await page.getByRole("button", { name: "Повторить", exact: true }).click();
    await expect(page.locator("[data-result-analysis]")).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    expectedFailure = false;
    await page.getByRole("button", { name: "Следующее задание", exact: true }).click();
    await page.locator(`input[value="${f.q(1)}-0"]`).check();
    await page.getByRole("button", { name: "Проверить", exact: true }).click();
    await page.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
    await page.getByRole("button", { name: "Просмотреть историю ответов", exact: true }).click();
    await expect(page.locator("details")).toHaveCount(2); await page.locator("summary").first().click(); await capture("history");
    results.push("PASS practice submit → result → reload → finish → history (real API)");
    await visit("/statistics", () => expect(page.getByText("Здесь будет ваш прогресс", { exact: true })).toHaveCount(0));
    await expect(page.locator(".recharts-wrapper").first()).toBeVisible(); await capture("statistics-populated");
    await visit("/mistakes", () => expect(page.getByText("Тест выбора", { exact: true }).first()).toBeVisible()); await capture("mistakes-populated");

    // UI navigation, keyboard mode selection and mobile menu focus restoration.
    await page.setViewportSize({ width: 360, height: 844 });
    await page.getByRole("button", { name: "Ещё", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible(); await fits(page, "mobile menu");
    await page.screenshot({ path: `${output}/mobile-menu.png`, animations: "disabled" });
    await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Ещё", exact: true })).toBeFocused();
    for (const href of ["/statistics", "/topics", "/geometry", "/diagnostics"]) {
      await page.getByRole("button", { name: "Ещё", exact: true }).click();
      await page.getByRole("dialog").locator(`a[href="${href}"]`).click(); await expect(page).toHaveURL(baseUrl + href); await expect(page.locator("h1")).toBeVisible();
    }
    await page.locator('nav a[href="/practice"]:visible').click();
    const firstMode = page.locator('input[name="practice-mode"]').first();
    await firstMode.focus(); await page.keyboard.press("ArrowDown"); await expect(page.locator('input[value="weak_topics"]')).toBeChecked();
    await page.locator('input[value="specific_topic"]').check(); await page.getByRole("combobox", { name: "Тема ЕНТ:", exact: true }).selectOption(f.topic.id);
    await page.getByLabel(/Или введи/).fill("1");
    await page.getByRole("button", { name: /Начать тренировку \(1\)/ }).click(); await expect(page).toHaveURL(/\/practice\/session\//);
    await expect(page.getByRole("radio")).toHaveCount(5);
    await page.getByRole("link", { name: "Назад", exact: true }).click(); await expect(page).toHaveURL(baseUrl + "/practice");
    results.push("PASS mobile menu, keyboard, practice setup → real session → back");

    await visit("/diagnostics", () => expect(page.getByRole("button", { name: "Начать входную диагностику", exact: true })).toBeVisible());
    await page.getByRole("button", { name: "Начать входную диагностику", exact: true }).click();
    await expect(page.getByRole("button", { name: "Сохранить и продолжить", exact: true })).toBeVisible(); await capture("diagnostic-active");
    let diagnostic = (await api("/api/diagnostics", f.a.cookie)).data[0];
    let snapshot = (await api(`/api/diagnostics/${diagnostic.id}`, f.a.cookie)).data;
    const firstQuestion = await prisma.question.findUniqueOrThrow({ where: { id: snapshot.question.id }, include: { steps: { include: { options: true }, orderBy: { order: "asc" } } } });
    for (const step of firstQuestion.steps) {
      if (step.type === "multiple_choice") await page.locator(`input[value="${step.options.find(option => option.isCorrect)!.id}"]`).check();
      else await page.getByRole("textbox", { name: step.prompt, exact: true }).fill(step.expectedAnswer);
    }
    await page.getByRole("button", { name: "Сохранить и продолжить", exact: true }).click();
    await expect.poll(async () => (await api(`/api/diagnostics/${diagnostic.id}`, f.a.cookie)).data.completedCount).toBe(1);
    snapshot = (await api(`/api/diagnostics/${diagnostic.id}`, f.a.cookie)).data;
    while (snapshot.status === "active") {
      const question = await prisma.question.findUniqueOrThrow({ where: { id: snapshot.question.id }, include: { steps: { include: { options: true } } } });
      const sent = await api(`/api/diagnostics/${diagnostic.id}/answers`, f.a.cookie, "POST", { submissionId: randomUUID(), questionId: question.id, revision: snapshot.revision,
        stepAnswers: question.steps.map(step => ({ stepId: step.id, answer: step.type === "multiple_choice" ? step.options.find(option => option.isCorrect)!.id : step.expectedAnswer })) });
      assert.equal(sent.status, 200, JSON.stringify(sent.data)); snapshot = (await api(`/api/diagnostics/${diagnostic.id}`, f.a.cookie)).data;
    }
    await page.reload(); await expect(page.getByRole("heading", { name: "Результат входной диагностики", exact: true })).toBeVisible(); await capture("diagnostic-result");
    const otherSkills = page.locator("details").filter({ has: page.locator("summary", { hasText: /^Другие навыки/ }) });
    await expect(otherSkills).not.toHaveAttribute("open", "");
    await otherSkills.locator("summary").first().click(); await expect(otherSkills).toHaveAttribute("open", "");
    await otherSkills.locator("summary").first().click();
    results.push("PASS /diagnostics (intro, active, completed report)");

    // An actual paper created by the existing exam generator, with a disposable owner.
    const exam = await api("/api/exams", f.a.cookie, "POST", { requestId: randomUUID(), profileId: TIPO_MATH.id, profileVersion: TIPO_MATH.version, language: "ru", durationMinutes: 40 });
    assert.equal(exam.status, 200, JSON.stringify(exam.data));
    const examRoute = `/exam/${exam.data.id}`;
    const guest = await browser.newContext({ serviceWorkers: "block" });
    try {
      const guestPage = await guest.newPage();
      guestPage.on("pageerror", error => errors.push(`guest runtime: ${error.message}`));
      await guestPage.goto(baseUrl + examRoute); await expect(guestPage).toHaveURL(/\/login$/);
      await expect(guestPage.getByLabel("Email", { exact: true })).toBeVisible();
    } finally { await guest.close(); }
    for (const route of ["/learning-road", `/learn/rules/${f.skill.id}`]) {
      await page.goto(baseUrl + route); await expect(page).toHaveURL(baseUrl + examRoute);
    }
    await visit(examRoute, () => expect(page.getByRole("radio")).toHaveCount(4)); await capture("exam-active");
    // Exam controls acknowledge a selection after the server saves it.
    await page.getByRole("radio").first().click();
    await expect(page.getByRole("radio").first()).toBeChecked();
    assert.equal((await api(`/api/exams/${exam.data.id}`, f.a.cookie)).data.answers[exam.data.questions[0].id], 0);
    await expect(page.getByRole("button", { name: "Далее", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Завершить экзамен", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible(); await fits(page,"exam confirmation"); await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Завершить экзамен", exact: true }).click();
    await page.getByRole("button", { name: "Подтвердить завершение", exact: true }).click();
    await expect(page.locator("h1")).toContainText("Результат:"); await capture("exam-result");
    results.push("PASS /exam/[examId] (real paper, answer, keyboard dialog, finish, result)");

    // Existing language controls and theme on populated, mathematical screens.
    await visit("/learning-road", () => expect(page.locator("[data-road-node]").first()).toBeVisible());
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByTitle("Қазақша", { exact: true }).click();
    await expect(page.locator("h1")).toHaveText("Менің оқу жолым"); await fits(page,"Kazakh road");
    await page.screenshot({ path: `${output}/road-kk.png`, fullPage: true });
    await page.getByTitle("English", { exact: true }).click(); await expect(page.locator("h1")).toHaveText("Learning Road");
    await page.reload(); await expect(page.locator("h1")).toHaveText("Learning Road");
    await page.getByTitle("Русский", { exact: true }).click(); await page.getByRole("button", { name: "Переключить тему оформления", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/); await capture("road-dark");
    await page.getByRole("button", { name: "Переключить тему оформления", exact: true }).click();
    await visit("/offline-practice.html", () => expect(page.locator("#app")).not.toContainText("Загрузка…")); await capture("offline"); results.push("PASS /offline-practice.html");
    await visit("/offline.html"); await capture("offline-fallback");
    await page.getByRole("link", { name: "Открыть скачанные тренировки", exact: true }).click();
    await expect(page).toHaveURL(baseUrl + "/offline-practice.html");
    results.push("PASS /offline.html (fallback → downloaded practice)");

    // Controlled failure and recovery: only resource errors for these requests are expected.
    expectedFailure = true;
    const recoveryRoutes = [["/statistics", "**/api/statistics"], ["/practice", "**/api/topics"], ["/mistakes", "**/api/mistakes?*"], ["/diagnostics", "**/api/skills"], [`/practice/session/${session.id}`, `**/api/sessions/${session.id}`]];
    // Repeated document loads catch production-only streaming/hydration races.
    for (const [route, endpoint] of [...recoveryRoutes, ...Array.from({ length: 3 }, () => [recoveryRoutes[0], recoveryRoutes[2]]).flat()]) {
      await page.route(endpoint, r => r.fulfill({ status: 503, json: { error: "Smoke test unavailable" } }));
      await visit(route); await expect(page.locator("main").getByRole("alert")).toBeVisible();
      await page.unroute(endpoint);
      const recovered = page.waitForResponse(response => response.url().startsWith(baseUrl + endpoint.replace("**", "").replace("*", "")) && response.request().method() === "GET");
      const retry = page.getByRole("button", { name: /^(Повторить загрузку|Обновить|Повторить)$/, exact: true }); await retry.click();
      assert.equal((await recovered).status(), 200);
      // Next's hidden route announcer also has role=alert; inspect the application landmark.
      await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
      console.log(`PASS error recovery ${route}`);
    }
    expectedFailure = false; assert.deepEqual(errors, []);
    results.push("PASS network error states and retry recovery (statistics, practice, mistakes, diagnostics, saved session/result)");
    console.log(results.join("\n"));
    await writeFile(`${output}/report.json`, JSON.stringify({ baseUrl, widths, publicRoutes: ["/login"], protectedRoutes: [...staticProtected,...dynamicPatterns], dynamicRoutes: dynamicPatterns, results, errors }, null, 2));
  } catch (error) {
    console.error("Smoke failure:", error);
    console.error("Overflow:", await page.locator("body *").evaluateAll(nodes => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, nodes: nodes.filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => ({ tag: node.tagName, id: node.id, class: node.getAttribute("class"), right: node.getBoundingClientRect().right })).slice(0, 30) })).catch(() => null));
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
    console.error("URL:", page.url(), "Errors:", errors, "Body:", (await page.locator("body").innerText().catch(() => "Browser closed")).slice(0,7000)); throw error;
  } finally { await browser.close(); await f.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
