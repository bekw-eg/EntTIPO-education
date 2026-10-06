import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { readdir, access, mkdir } from "node:fs/promises";
import path from "node:path";
import { choiceFixture, baseUrl, prisma } from "./choice_test_fixture";
async function executable() {
  if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if(process.platform!=="win32") return undefined;
  const root=path.join(process.env.LOCALAPPDATA??"","ms-playwright");
  for(const name of (await readdir(root)).filter(n=>n.startsWith("chromium-")).reverse()) for(const folder of ["chrome-win64","chrome-win"]) {
    const file=path.join(root,name,folder,"chrome.exe"); try{await access(file);return file;}catch{}
  }
}
async function main() {
  const f=await choiceFixture(),browser=await chromium.launch({headless:true,executablePath:await executable()});
  const context=await browser.newContext({serviceWorkers:"allow"});context.setDefaultTimeout(30000);
  await context.addInitScript("globalThis.__name = (fn) => fn;");
  const origin=new URL(baseUrl),separator=f.a.cookie.indexOf("=");
  await context.addCookies([{name:f.a.cookie.slice(0,separator),value:f.a.cookie.slice(separator+1),domain:origin.hostname,path:"/",httpOnly:true,sameSite:"Lax"}]);
  const errors:string[]=[];
  let page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
  try {
    const session=await f.session(f.a.id,[f.q(0),f.q(1)]);
    const url=`${baseUrl}/practice/session/${session.id}`;
    await page.goto(url);await expect(page.getByRole("radio")).toHaveCount(5);await expect(page.getByRole("textbox")).toHaveCount(0);
    assert.ok(await page.locator(".katex").count()>=6);await expect(page.locator(".katex-error")).toHaveCount(0);
    await mkdir("tmp",{recursive:true});await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:"tmp/choice-single-mobile.png",fullPage:true});
    await page.setViewportSize({width:1280,height:900});
    await page.locator(`input[value="${f.q(0)}-1"]`).check();await expect(page.getByRole("status").filter({hasText:"Ответы сохранены"})).toBeVisible();
    await context.setOffline(true);await page.locator(`input[value="${f.q(0)}-2"]`).check();
    await page.close();await context.setOffline(false);page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
    await page.goto(url);await expect(page.locator(`input[value="${f.q(0)}-2"]`)).toBeChecked();
    await page.locator(`input[value="${f.q(0)}-0"]`).check();await page.getByRole("button",{name:"Проверить",exact:true}).click();
    await expect(page.getByText("Задание выполнено правильно",{exact:true})).toBeVisible();
    await expect(page.getByText("Правильный ответ",{exact:true})).toBeVisible();await expect(page.getByRole("radio")).toHaveCount(0);
    await page.reload();await expect(page.getByText("Задание выполнено правильно",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Следующее задание",exact:true}).click();await expect(page.getByRole("radio")).toHaveCount(5);
    await page.locator(`input[value="${f.q(1)}-2"]`).check();await page.getByRole("button",{name:"Проверить",exact:true}).click();
    await page.getByRole("button",{name:"Решить задание",exact:false}).click();await expect(page.getByRole("radio")).toHaveCount(5);
    await page.locator(`input[value="${f.q(1)}-0"]`).check();await page.getByRole("button",{name:"Проверить",exact:true}).click();
    await page.getByRole("button",{name:"Завершить тренировку",exact:true}).click();
    await page.getByRole("button",{name:"Просмотреть историю ответов",exact:true}).click();await expect(page.locator("details")).toHaveCount(3);
    assert.equal(await prisma.userAttempt.count({where:{sessionId:session.id}}),3);
    const stats=await prisma.practiceSession.findUniqueOrThrow({where:{id:session.id}});assert.equal(stats.completedCount,2);
    const multi=await f.session(f.a.id,[f.q(21),...Array.from({length:19},(_,i)=>f.q(i))]);
    await page.goto(`${baseUrl}/practice/session/${multi.id}`);await expect(page.getByRole("checkbox")).toHaveCount(5);
    await expect(page.getByText("Выберите все правильные ответы",{exact:true})).toBeVisible();
    await page.screenshot({path:"tmp/choice-multiple.png",fullPage:true});
    await page.locator(`input[value="${f.q(21)}-0"]`).check();await page.locator(`input[value="${f.q(21)}-1"]`).check();
    await expect(page.getByRole("status").filter({hasText:"Ответы сохранены"})).toBeVisible();await page.reload();
    await expect(page.locator("input:checked")).toHaveCount(2);await page.getByRole("button",{name:"Проверить",exact:true}).click();
    await expect(page.getByText("Задание выполнено правильно",{exact:true})).toBeVisible();
    await page.goto(`${baseUrl}/practice/session/${session.id}`);await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:"tmp/choice-browser.png",fullPage:true});
    // Fresh offline packages contain no keys and preserve choices through a disconnected restart.
    await page.goto(`${baseUrl}/offline-practice.html`);
    await page.locator(`input[value="${f.topic.id}"]`).check();await page.getByLabel("Количество заданий (1–50)").fill("1");
    await page.getByRole("button",{name:"Скачать пакет",exact:true}).click();
    await expect(page.getByText("Доступно офлайн",{exact:true}).last()).toBeVisible({timeout:60000});
    await page.getByRole("button",{name:"Открыть тренировку",exact:true}).click();
    await expect(page.getByRole("radio")).toHaveCount(5);await expect(page.getByRole("textbox")).toHaveCount(0);
    const offlineQuestion=await page.locator("[data-question-id]").getAttribute("data-question-id");
    await context.setOffline(true);await page.locator(`input[value="${offlineQuestion}-0"]`).check();
    await expect(page.locator("#draft-status")).toHaveText("Сохранено на устройстве");
    await page.close();page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
    await page.goto(`${baseUrl}/offline-practice.html`);await page.getByRole("button",{name:"Открыть тренировку",exact:true}).click();
    await expect(page.locator(`input[value="${offlineQuestion}-0"]`)).toBeChecked();
    await page.getByRole("button",{name:"Проверить",exact:true}).click();
    await expect(page.getByText("Ожидает синхронизации",{exact:true})).toBeVisible();
    await expect(page.locator('input[type="radio"]:enabled')).toHaveCount(0);
    await context.setOffline(false);await page.getByRole("button",{name:"Синхронизировать",exact:true}).click();
    await expect(page.getByText("Синхронизировано",{exact:true})).toBeVisible({timeout:60000});
    await expect(page.getByRole("heading",{name:"Правильный ответ / Дұрыс жауап"})).toBeVisible();
    await expect(page.locator(".katex-error")).toHaveCount(0);
    assert.deepEqual(errors,[]);
    console.log("PASS: browser A–E, KaTeX, changing selection, close recovery, result lock/reload, retry, cursor, history and offline restart/sync; screenshots saved");
  } finally {await browser.close();await f.cleanup();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
