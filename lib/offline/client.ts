import katex from "katex";
import { choiceLatex } from "../choiceDisplay";
import { activeAccount, offlineLocked, setActiveAccount, listPackages, savePackage, getWork, saveDraft, enqueue, queueFor, deletePackage, updateWork } from "./store";
import { request, synchronize } from "./sync";
import { cacheAssets, assetsReady } from "./assets";
import type { Answers, OfflineAccount, OfflineLanguage, OfflinePackage, OfflineWork, QueueEntry } from "./types";

const messages = {
  title: ["Офлайн-практика", "Желісіз жаттығу"], online: ["Онлайн-практика", "Онлайн жаттығу"],
  connected: ["Сеть доступна. Ответы отправляются только после проверки аккаунта.", "Желі бар. Жауаптар аккаунт тексерілгеннен кейін жіберіледі."],
  disconnected: ["Нет сети. Можно продолжать скачанную тренировку.", "Желі жоқ. Жүктелген жаттығуды жалғастыруға болады."],
  login: ["Войти снова", "Қайта кіру"], logout: ["Закрыть офлайн-доступ и выйти", "Желісіз қолжетімділікті жауып, шығу"],
  required: ["Требуется повторный вход в этот аккаунт. Работа сохранена на устройстве.", "Осы аккаунтқа қайта кіру қажет. Жұмыс құрылғыда сақталған."],
  noAccount: ["Войдите в личный аккаунт с интернетом, чтобы скачать материалы. После выхода офлайн-данные скрыты.", "Материал жүктеу үшін желі арқылы жеке аккаунтқа кіріңіз. Шыққаннан кейін желісіз деректер жасырын болады."],
  intro: ["Скачайте темы и задания, выберите ответы A–E и нажмите «Проверить». Без сети ответы сохраняются на устройстве; результат и объяснение появятся после серверной проверки. Mastery учитывает помощь. Подтверждение ошибки требует отдельной самостоятельной онлайн-проверки.", "Тақырыптар мен тапсырмаларды жүктеп, A–E жауаптарын таңдаңыз және «Тексеру» түймесін басыңыз. Желісіз жауаптар құрылғыда сақталады; нәтиже мен түсіндіру сервер тексергеннен кейін көрсетіледі. Mastery көмекті ескереді. Қатені меңгеруді растау үшін бөлек дербес онлайн тексеру керек."],
  exam: ["Экзамен без сети не поддерживается: сервер контролирует срок, завершение, сохранение ответов и достоверность результата. Офлайн-пакеты не содержат экзаменационные или контрольные задания.", "Желісіз емтихан қолдау таппайды: мерзімді, аяқтауды, жауаптардың сақталуы мен нәтиженің дұрыстығын сервер бақылайды. Желісіз пакеттерде емтихан немесе бақылау тапсырмалары жоқ."],
  ai: ["AI-помощник недоступен без сети. Используйте скачанные правила и материалы.", "AI көмекшісі желісіз қолжетімсіз. Жүктелген ережелер мен материалдарды пайдаланыңыз."],
  download: ["Скачать пакет", "Пакетті жүктеу"], topics: ["Темы и правила", "Тақырыптар мен ережелер"], count: ["Количество заданий (1–50)", "Тапсырмалар саны (1–50)"],
  downloaded: ["Скачанные материалы", "Жүктелген материалдар"], empty: ["Пакетов пока нет.", "Пакеттер әзірге жоқ."],
  ready: ["Доступно офлайн", "Желісіз қолжетімді"], saved: ["Сохранено на устройстве", "Құрылғыда сақталды"], saving: ["Сохранение на устройстве…", "Құрылғыда сақталуда…"],
  sync: ["Синхронизировать", "Синхрондау"], synced: ["Синхронизировано", "Синхрондалды"], waiting: ["Ожидает синхронизации", "Синхрондауды күтуде"],
  checking: ["Ожидает проверки", "Тексеруді күтуде"], preliminary: ["Предварительно верно", "Алдын ала дұрыс"], wrong: ["Предварительно неверно", "Алдын ала қате"],
  open: ["Открыть тренировку", "Жаттығуды ашу"], update: ["Скачать новую версию отдельно", "Жаңа нұсқаны бөлек жүктеу"], remove: ["Удалить пакет", "Пакетті жою"],
  export: ["Экспортировать ответы", "Жауаптарды экспорттау"], back: ["К пакетам", "Пакеттерге"], prev: ["Предыдущее", "Алдыңғы"], next: ["Следующее", "Келесі"],
  submit: ["Проверить", "Тексеру"], materials: ["Правила и материалы", "Ережелер мен материалдар"],
  conflict: ["Состояние изменилось на другом устройстве. Ответы и идентификаторы сохранены. Можно явно отправить оставшуюся работу с текущим состоянием сервера; другой ответ на то же задание будет отдельной попыткой.", "Күй басқа құрылғыда өзгерді. Жауаптар мен идентификаторлар сақталды. Қалған жұмысты сервердің қазіргі күйімен жіберуге болады; сол тапсырмаға басқа жауап бөлек әрекет болады."],
  stale: ["Версия контента изменилась. Ответы сохранены. Можно явно перепроверить их по текущим эталонам; при изменении структуры задания потребуется новый пакет и экспорт прежней работы.", "Контент нұсқасы өзгерді. Жауаптар сақталды. Оларды қазіргі эталондармен қайта тексеруге болады; тапсырма құрылымы өзгерсе, жаңа пакет пен бұрынғы жұмысты экспорттау қажет."],
  resolve: ["Принять текущую версию и отправить сохранённые ответы", "Қазіргі нұсқаны қабылдап, сақталған жауаптарды жіберу"],
  notReady: ["Ресурсы пакета отсутствуют. Подключите сеть и скачайте их заново. Ответы сохранены.", "Пакет ресурстары жоқ. Желіге қосылып, қайта жүктеңіз. Жауаптар сақталған."],
  incomplete: ["Скачивание ещё не завершено", "Жүктеу әлі аяқталмады"], completed: ["Все задания сохранены. Можно вернуться к любому ответу.", "Барлық тапсырмалар сақталды. Кез келген жауапқа қайтуға болады."],
  server: ["Сервер перепроверил ответ", "Сервер жауапты қайта тексерді"], deviceError: ["Не удалось сохранить. Оставьте страницу открытой и экспортируйте ответы; проверьте свободное место на устройстве.", "Сақтау мүмкін болмады. Бетті ашық қалдырып, жауаптарды экспорттаңыз; құрылғыдағы бос орынды тексеріңіз."],
  deleteBlocked: ["Пакет содержит несинхронизированные ответы или черновик. Сначала синхронизируйте работу; экспорт сохранит отдельную резервную копию.", "Пакетте синхрондалмаған жауаптар немесе жоба бар. Алдымен жұмысты синхрондаңыз; экспорт бөлек резервтік көшірме сақтайды."],
  draftConflict: ["Черновик изменился в другой вкладке. Откройте тренировку заново; экспорт сохранит копию введённых здесь ответов.", "Жоба басқа қойындыда өзгерді. Жаттығуды қайта ашыңыз; экспорт осы жерде енгізілген жауаптардың көшірмесін сақтайды."],
  answerRequired: ["Выберите ответ перед проверкой.", "Тексеруден бұрын жауапты таңдаңыз."],
  order: ["Сначала сохраните предыдущие задания.", "Алдымен алдыңғы тапсырмаларды сақтаңыз."],
  forbidden: ["Синхронизация временно запрещена. Если открыт экзамен, завершите его на сервере. Ответы сохранены на устройстве.", "Синхрондауға уақытша тыйым салынған. Емтихан ашық болса, оны серверде аяқтаңыз. Жауаптар құрылғыда сақталған."],
} satisfies Record<string, [string, string]>;
function storedSetting(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
let language: OfflineLanguage = storedSetting("ent_tipo_locale") === "kk" ? "kk" : "ru";
const t = (key: keyof typeof messages) => messages[key][language === "kk" ? 1 : 0];
const app = document.querySelector<HTMLDivElement>("#app")!;
const notice = document.querySelector<HTMLParagraphElement>("#notice")!;
const identity = document.querySelector<HTMLDivElement>("#identity")!;
let account: OfflineAccount | null = null;
let epoch = 0;
let selected: OfflinePackage | null = null;
let work: OfflineWork | undefined;
let entries: QueueEntry[] = [];
let writes = Promise.resolve();
let dirty = false;
let pendingWrites = 0;
let visibleAnswers: Answers = {};
let downloadBusy = false;
let downloadId: string | undefined;
let topicList: { id: string; name: string; nameKk?: string }[] = [];
const e = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") => {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
};
function say(message: string) { notice.textContent = message; }
function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Synchronize or export")) return t("deleteBlocked");
  if (message.includes("another tab")) return t("draftConflict");
  if (message.includes("Answer every step")) return t("answerRequired");
  if (message.includes("original order")) return t("order");
  return message;
}
function button(label: string, action: () => void | Promise<void>, className = "") {
  const node = e("button", label, className); node.type = "button";
  node.onclick = () => { void Promise.resolve().then(action).catch(error => say(friendlyError(error))); };
  return node;
}
function math(parent: HTMLElement, value: string, displayMode = false) {
  const node = e("span", "", "math");
  try { katex.render(value, node, { throwOnError: false, trust: false, displayMode }); }
  catch { node.textContent = value; }
  parent.append(node);
}
function text(parent: HTMLElement, content: string) {
  for (const line of content.split("\n")) {
    const node = e("p");
    if (!line.includes("$") && /\\(?:frac|sqrt|int|implies|sin|cos)/.test(line) && !/[а-яА-Яәіңғүұқөһ]/i.test(line)) math(node, line);
    else for (const part of line.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g)) {
      if (part.startsWith("$$") && part.endsWith("$$")) math(node, part.slice(2, -2), true);
      else if (part.startsWith("$") && part.endsWith("$")) math(node, part.slice(1, -1));
      else if (part.startsWith("\\(") || part.startsWith("\\[")) math(node, part.slice(2, -2), part.startsWith("\\["));
      else node.append(document.createTextNode(part));
    }
    parent.append(node);
  }
}
function optionText(parent: HTMLElement, content: string) {
  const unit = content.match(/^(.*?)\s+(см|cm)([²³])$/i);
  if (unit) { math(parent, choiceLatex(unit[1])); parent.append(document.createTextNode(` ${unit[2]}${unit[3]}`)); }
  else if (!content.includes("$") && !/[а-яА-Яәіңғүұқөһ]/i.test(content)) math(parent, choiceLatex(content));
  else text(parent, content);
}
function connection() {
  document.querySelector("#connection")!.textContent = t(navigator.onLine ? "connected" : "disconnected");
  document.querySelector("#title")!.textContent = t("title");
  document.querySelector("#online-link")!.textContent = t("online");
  document.documentElement.lang = language;
}
async function currentOwner() { return account && (await activeAccount())?.userId === account.userId; }
async function establish() {
  const version = ++epoch;
  selected = null; app.replaceChildren(); identity.replaceChildren();
  let owner = await activeAccount();
  if (navigator.onLine && !await offlineLocked()) {
    try {
      const response = await request("/api/auth/me");
      if (response.ok) {
        const me = await response.json();
        if (me.user?.id) {
          owner = { userId: me.user.id, name: me.user.name };
          if (version !== epoch) return;
          await setActiveAccount(owner);
        }
      } else if (response.status === 401 && owner) {
        owner = { ...owner, requiresLogin: true };
        if (version !== epoch) return;
        await setActiveAccount(owner);
      }
    } catch { /* Keep the previously authenticated offline scope during an outage. */ }
  }
  if (version !== epoch) return;
  account = owner ?? null;
  showIdentity(); connection();
  await library();
  if (account && navigator.onLine) void synchronize(account.userId).then(refresh).catch(error => say(String(error)));
}
function showIdentity() {
  identity.replaceChildren();
  if (!account) {
    identity.append(e("p", t("noAccount")), Object.assign(e("a", t("login")), { href: "/login" })); return;
  }
  identity.append(e("p", account.name));
  if (account.requiresLogin) identity.append(e("p", t("required"), "warning"), Object.assign(e("a", t("login")), { href: "/login" }));
  identity.append(button(t("logout"), async () => {
    // Hide before attempting the network logout, even when disconnected.
    try { localStorage.setItem("enttipo_offline_locked", "1"); } catch { /* IndexedDB still locks the scope. */ }
    await setActiveAccount(null); ++epoch; account = null; selected = null; app.replaceChildren(); showIdentity();
    try { await request("/api/auth/logout", { method: "POST" }); } catch { /* Scope remains locked. */ }
    await library();
  }));
}
async function loadTopics() {
  if (!navigator.onLine || !account) return;
  try {
    const response = await request("/api/topics");
    if (response.ok) topicList = await response.json();
  } catch { /* Download form can return when connected. */ }
}
async function download(topicIds: string[], count: number, packLanguage: OfflineLanguage, id = downloadId ??= crypto.randomUUID()) {
  if (!account || downloadBusy) return;
  downloadBusy = true; const userId = account.userId; say(t("incomplete"));
  try {
    const response = await request("/api/offline/packages", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ downloadId: id, topicIds, language: packLanguage, count }) });
    const pack: OfflinePackage & { error?: string } = await response.json();
    if (!response.ok) throw new Error(pack.error || "Download failed");
    if (pack.userId !== userId || !await currentOwner()) throw new Error("Account changed");
    await cacheAssets(pack.assets, (done, total) => say(`${t("incomplete")}: ${done}/${total}`));
    if (!await currentOwner()) throw new Error("Account changed");
    await savePackage(pack); downloadId = undefined; say(t("ready")); await library();
  } finally { downloadBusy = false; }
}
async function library() {
  selected = null;
  const version = epoch;
  const packs = account ? await listPackages(account.userId) : [];
  await loadTopics();
  if (version !== epoch) return;
  app.replaceChildren();
  if (!account) return;
  const intro = e("section"); intro.append(e("p", t("intro")), e("p", t("exam"), "muted"), e("p", t("ai"), "muted")); app.append(intro);
  if (navigator.onLine && !account.requiresLogin && topicList.length) {
    const form = e("section"); form.append(e("h2", t("topics")));
    const boxes = topicList.map(topic => {
      const box = e("input"); box.type = "checkbox"; box.value = topic.id;
      const label = e("label"); label.append(box, document.createTextNode(language === "kk" ? topic.nameKk || topic.name : topic.name)); form.append(label); return box;
    });
    const count = e("input"); count.type = "number"; count.min = "1"; count.max = "50"; count.value = "10";
    const label = e("label", t("count")); label.append(count); form.append(label);
    boxes.forEach(box => box.onchange = () => { downloadId = undefined; }); count.oninput = () => { downloadId = undefined; };
    form.append(button(t("download"), () => download(boxes.filter(b => b.checked).map(b => b.value), Number(count.value), language), "primary")); app.append(form);
  }
  app.append(e("h2", t("downloaded")));
  if (!packs.length) app.append(e("p", t("empty")));
  for (const pack of packs) {
    const ready = await assetsReady(pack.assets);
    const queued = await queueFor(account.userId, pack.sessionId);
    if (version !== epoch || !await currentOwner()) return;
    const card = e("section"); card.dataset.packageId = pack.id; card.append(e("h2", pack.title));
    card.append(e("p", `${pack.language.toUpperCase()} · ${pack.questions.length} · ${((pack.bytes + pack.assetBytes) / 1024 / 1024).toFixed(2)} MB`));
    card.append(e("small", `v1/${pack.contentVersion.slice(0, 12)} · ${new Date(pack.downloadedAt).toLocaleDateString(pack.language)}`));
    card.append(e("p", t(ready ? "ready" : "notReady"), ready ? "status" : "warning"));
    card.append(e("small", `${t("materials")}: ${[...pack.rules.map(r => r.title), ...pack.materials.map(m => m.title)].join(" · ") || pack.title}`));
    const pending = queued.filter(q => !q.receipt).length;
    if (queued.length) card.append(e("p", `${t(pending ? "waiting" : "synced")}: ${pending || queued.length}`, "status"));
    const actions = e("div", "", "actions");
    actions.append(button(t("open"), () => openTraining(pack)), button(t("update"), () => download(pack.topicIds, pack.questions.length, pack.language, crypto.randomUUID())));
    if (!ready) actions.append(button(t("download"), async () => { await cacheAssets(pack.assets); say(t("ready")); await library(); }));
    actions.append(button(t("export"), () => exportWork(pack)), button(t("remove"), async () => { await deletePackage(pack); await library(); }, "danger"));
    card.append(actions); app.append(card);
  }
}
async function openTraining(pack: OfflinePackage) {
  await writes;
  if (!account || pack.userId !== account.userId || !await currentOwner()) return;
  selected = pack; language = pack.language; connection();
  work = await getWork(pack.userId, pack.sessionId); entries = await queueFor(pack.userId, pack.sessionId);
  renderTraining();
}
function renderTraining() {
  if (!selected || !work || !account || selected.userId !== account.userId) return;
  const pack = selected, state = work;
  app.replaceChildren();
  app.append(button(t("back"), async () => { await writes; await library(); }));
  const heading = e("section"); heading.append(e("h2", pack.title), e("p", `${state.currentIndex + 1} / ${pack.questions.length} · ${pack.language.toUpperCase()}`));
  heading.append(e("p", t("intro"), "muted"), e("p", t("ai"), "muted"));
  heading.append(button(t("sync"), async () => { await synchronize(pack.userId); await refresh(); }));
  if (state.blocked) {
    heading.append(e("p", t(state.blocked === "auth" ? "required" : state.blocked === "stale" ? "stale" : state.blocked === "error" ? "forbidden" : "conflict"), "warning"));
    if (state.blocked === "auth") heading.append(Object.assign(e("a", t("login")), { href: "/login" }));
    else heading.append(button(t("resolve"), async () => {
      const response = await request(`/api/offline/packages/${pack.id}`);
      const current = await response.json();
      if (!response.ok || current.userId !== pack.userId || current.sessionId !== pack.sessionId) throw new Error(current.error || "Account changed");
      await updateWork(pack.userId, pack.sessionId, { revision: current.revision, acceptedVersion: current.currentVersion, reconcile: true, blocked: undefined, message: undefined });
      await synchronize(pack.userId); await refresh();
    }));
  }
  heading.append(button(t("export"), () => exportWork(pack))); app.append(heading);
  const materials = e("details"); materials.append(e("summary", t("materials")));
  for (const rule of pack.rules) { const node = e("section"); node.append(e("h2", rule.title)); text(node, rule.text); materials.append(node); }
  for (const material of pack.materials) { const node = e("section"); node.append(e("h2", material.title)); text(node, material.text); if (material.latex) math(node, material.latex, true); materials.append(node); }
  app.append(materials);
  const question = pack.questions[state.currentIndex];
  const sent = entries.find(entry => entry.questionId === question.id);
  visibleAnswers = { ...(state.answers[question.id] ?? {}) };
  const section = e("section"); section.dataset.questionId = question.id;
  section.append(e("h2", question.title)); text(section, question.text); if (question.latex) math(section, question.latex, true);
  const status = e("p", t("saved"), "status"); status.id = "draft-status";
  section.append(status);
  for (const step of question.steps) {
    const field = e("fieldset"), legend = e("legend");
    for (const part of step.prompt.split(/(\$[^$]+\$)/g)) {
      if (part.startsWith("$") && part.endsWith("$")) math(legend, part.slice(1, -1));
      else legend.append(document.createTextNode(part));
    }
    field.append(legend);
    const setAnswer = (value: string) => {
      visibleAnswers[step.id] = value; dirty = true; pendingWrites++; status.textContent = t("saving");
      const answers = { ...visibleAnswers };
      writes = writes.then(async () => {
        if (!work) return;
        work = await saveDraft(pack.userId, pack.sessionId, work.localRevision, question.id, answers, state.currentIndex);
        pendingWrites--; dirty = pendingWrites > 0; if (selected?.id === pack.id && !dirty) status.textContent = t("saved");
      }).catch(error => { pendingWrites--; dirty = true; status.textContent = t("deviceError"); say(friendlyError(error)); });
    };
    if (step.type === "multiple_choice" || step.type === "multiple_select") {
      for (const [optionIndex, option] of step.options.entries()) {
        const input = e("input"); input.type = step.type === "multiple_choice" ? "radio" : "checkbox"; input.name = step.id; input.value = option.id; input.disabled = !!sent;
        let selectedIds: string[] = []; try { selectedIds = JSON.parse(visibleAnswers[step.id] || "[]"); } catch { /* empty draft */ }
        input.checked = step.type === "multiple_choice" ? visibleAnswers[step.id] === option.id : selectedIds.includes(option.id);
        input.onchange = () => {
          if (step.type === "multiple_choice") setAnswer(option.id);
          else setAnswer(JSON.stringify([...field.querySelectorAll<HTMLInputElement>('input:checked')].map(i => i.value)));
        };
        const label = e("label"); label.append(input, e("strong", `${String.fromCharCode(65 + optionIndex)}. `));
        optionText(label, option.text); field.append(label);
      }
    } else {
      const input = e("input"); input.type = "text"; input.maxLength = 2000; input.value = visibleAnswers[step.id] || ""; input.disabled = !!sent; input.setAttribute("aria-label", step.prompt); input.dataset.stepId = step.id;
      input.oninput = () => setAnswer(input.value); field.append(input);
    }
    if (sent) {
      const result = sent.receipt?.result.stepResults.find(r => r.stepId === step.id);
      field.append(e("p", sent.receipt ? `${t("server")}: ${result?.isCorrect ? "✓" : "✗"}` : t(sent.local[step.id] === "pending" ? "checking" : sent.local[step.id] === "correct" ? "preliminary" : "wrong"), "status"));
    } else if (!step.localKey) field.append(e("small", t("checking")));
    section.append(field);
  }
  if (sent) {
    section.append(e("p", t(sent.receipt ? "synced" : "waiting"), "status"));
    const result = sent.receipt?.result;
    if (result?.choice) for (const [title, ids] of [["Ваш ответ / Сіздің жауабыңыз", result.choice.selectedOptionIds],
      ["Правильный ответ / Дұрыс жауап", result.choice.correctOptionIds]] as const) {
      section.append(e("h3", title));
      for (const [index, option] of result.choice.options.entries()) if (ids.includes(option.id)) {
        const line = e("p", `${String.fromCharCode(65 + index)}. `);
        optionText(line, language === "kk" ? option.textKk ?? option.text : option.text); section.append(line);
      }
    }
    if (result?.explanation) text(section, language === "kk" ? result.explanationKk ?? result.explanation : result.explanation);
  }
  const submit = button(t("submit"), async () => {
    await writes; if (!work || dirty) throw new Error(t("deviceError"));
    await enqueue(pack, question.id, work.localRevision);
    await openTraining(pack);
    if (navigator.onLine) void synchronize(pack.userId).then(refresh);
  }, "primary"); submit.disabled = !!sent || entries.length !== state.currentIndex; section.append(submit);
  const navigation = e("div", "", "actions");
  const move = async (offset: number) => {
    await writes; if (!work || dirty) throw new Error(t("deviceError"));
    work = await saveDraft(pack.userId, pack.sessionId, work.localRevision, question.id, visibleAnswers, state.currentIndex + offset);
    await openTraining(pack);
  };
  const previous = button(t("prev"), () => move(-1)); previous.disabled = state.currentIndex === 0;
  const next = button(t("next"), () => move(1)); next.disabled = !sent || state.currentIndex + 1 >= pack.questions.length;
  navigation.append(previous, next); section.append(navigation);
    if (entries.length === pack.questions.length) section.append(e("p", t("completed")));
  app.append(section);
}
async function exportWork(pack: OfflinePackage) {
  await writes;
  const state = await getWork(pack.userId, pack.sessionId), queue = await queueFor(pack.userId, pack.sessionId);
  const blob = new Blob([JSON.stringify({ format: 1, package: pack, work: state, queue,
    ...(dirty ? { unsavedVisibleAnswers: visibleAnswers } : {}) }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob), link = e("a"); link.href = url; link.download = `synaq-offline-${pack.id}.json`; link.click(); URL.revokeObjectURL(url);
}
async function refresh() {
  const owner = await activeAccount();
  if (owner?.userId !== account?.userId) { ++epoch; account = owner ?? null; selected = null; app.replaceChildren(); showIdentity(); await library(); return; }
  account = owner ?? null; showIdentity(); connection();
  if (selected) {
    work = await getWork(selected.userId, selected.sessionId); entries = await queueFor(selected.userId, selected.sessionId);
    // Keep focus and unsaved input while the queue runs in the background.
    if (!dirty && document.activeElement?.tagName !== "INPUT") renderTraining();
  }
}
const languageSelect = document.querySelector<HTMLSelectElement>("#language")!; languageSelect.value = language;
languageSelect.onchange = () => {
  language = languageSelect.value as OfflineLanguage; downloadId = undefined;
  try { localStorage.setItem("ent_tipo_locale", language); } catch { /* Optional UI preference. */ }
  connection(); if (selected) renderTraining(); else void library();
};
window.addEventListener("offline", connection);
window.addEventListener("online", () => { connection(); if (account) void synchronize(account.userId).then(refresh); else void establish(); });
window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("storage", event => {
  if (event.key === "enttipo_offline_account_changed" || event.key === "enttipo_auth_changed") { ++epoch; app.replaceChildren(); identity.replaceChildren(); void refresh().catch(error => say(String(error))); }
});
setInterval(() => { if (account && navigator.onLine && !downloadBusy) void synchronize(account.userId).then(refresh).catch(error => say(String(error))); }, 15000);
void establish().catch(error => say(`${t("deviceError")} ${String(error)}`));
