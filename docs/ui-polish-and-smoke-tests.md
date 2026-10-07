# UI consistency and route smoke tests

Scope: existing ENT TIPO application, preserving authentication, Prisma schema,
choice IDs/snapshots, grading, UUID idempotency, mastery, diagnostic selection,
exam generation and offline synchronization. Work starts from `f3de4aa` on
`feature/ui-polish-and-smoke-tests`.

## Audit before implementation

| Page / component | Observed problem | Resolution |
| --- | --- | --- |
| Header and navigation | At 360px the greeting is truncated to a few characters; nine mobile destinations require horizontal scrolling; desktop account badge is generic | Separate controls from title; shared navigation definitions; four primary destinations and a keyboard accessible More dialog; actual account name |
| Dashboard and daily plan | Four colored metric cards, a duplicate streak card, repeated primary actions, cards inside the plan | Daily plan first, neutral metric row, sequential plan rows with one current action, secondary learning-road link |
| Practice setup | Offline and diagnostic promos precede the main task; mode selection uses clickable divs | Native labeled radio inputs, mode → count → start, compact secondary links |
| Question | Assistance repeated above and below the question; nested answer frames; difficulty dots compete with task | Topic/progress → question → options → check, single assistance location, labeled legacy inputs |
| Result analysis and history | Several competing rounded panels, nested answer blocks, 16px radii distinct from the rest of the UI | Keep one article per actual mistake; rule/retry use simple lesson sections; preserve explicit classification and one generic notice |
| Diagnostics and skill rule | Raw answers and rule expressions; very narrow three-column skill cards; rule page lacks h1; all unobserved skills overwhelm the report | Existing KaTeX display adapter, observed skills first, expandable remaining catalog, common title and reading width |
| Statistics | Header CTA causes page overflow at 360px; failed API reads become zero statistics; empty charts dominate | Actionable next topic, plain metric row, responsive topic list, explicit error/retry and first-session state |
| Mistakes and reviews | Unlabeled selects, crowded filter row, loading failure appears as no mistakes | Labels, wrapping controls, error/retry, separate due-review empty message, formatted answers |
| Topics and geometry | Truncated topic names; nested formula frames; raw geometry properties; tiny drawing controls | Two-column catalog, readable names and lesson sections, KaTeX, named touch controls |
| Exam and coverage | Wide reading screens, long introduction, manual confirmation without dialog focus behavior | Common reading width, details for secondary specification, Radix dialog, math answers in review |
| Learning road | Large circular nodes and duplicate mobile title | Compact rounded nodes, retained vertical path, common title and keyboard behavior |
| Login and offline | Heavy shadows, nested main landmarks, unrelated offline colors | Quiet auth form, one main landmark, consistent offline sizing, focus and dark theme |
| Shared primitives | Default card shadow everywhere, mixed radii, small inputs, full-width mobile dialogs, disabled viewport zoom | Shared tokens, no default card shadow, 44px input/control targets, bounded dialogs, browser zoom restored |

Before screenshots are local artifacts under `tmp/ui-audit/before/`.
The initial browser audit confirmed statistics overflow and the missing h1 on
the skill-rule page. The rest of the audit also inspected the actual page/component
source and existing learning documentation. Baseline lint/typecheck passed with
13 existing hook dependency warnings.

## Design rules

- Neutral warm page background, white surfaces, restrained blue for primary
  action/current state/focus/progress. Success/error retain their semantic use.
- Shared `.page-content`: max 70rem with 16/24/32px responsive side padding.
  `.reading-content`: max 48rem; result analysis stays max 42rem.
- Radii: small 6px, medium 8px, large 10px. Circles remain appropriate for
  avatars and progress indicators.
- Page title 24/30px semibold; section title 18px; normal body 14/16px with
  relaxed line height. Long titles wrap.
- Cards group a single learning object. Rows, metric groups, rules and retry
  sections do not each need another surface.
- Primary, outline and ghost actions use shared button variants. Controls have
  visible keyboard focus, comfortable targets and text wrapping.
- Math formatting is display-only. Long formulae have local horizontal scrolling;
  the page itself must fit the viewport. Input syntax examples remain literal.
- RU/KK/EN interface strings remain in the existing language provider. New shared
  navigation/state text is in `lib/i18n/interface.ts`; educational translations
  and their existing fallbacks are preserved.

## Real route inventory

15 App Router pages: **1 public, 14 protected, including 4 dynamic patterns**.
No URL locale segments exist. Two public static offline pages are also tested.

| Access | Route |
| --- | --- |
| Public | `/login` (login and registration tabs) |
| Protected | `/` (dashboard and daily plan) |
| Protected | `/practice` |
| Protected, dynamic | `/practice/session/[sessionId]` (question, result, summary and answer history) |
| Protected | `/diagnostics` (intro, active session, report) |
| Protected | `/statistics` |
| Protected | `/learning-road` |
| Protected | `/topics` |
| Protected, dynamic | `/topics/[topicId]` |
| Protected, dynamic | `/learn/rules/[skillId]` |
| Protected | `/mistakes` (including due reviews) |
| Protected | `/geometry` |
| Protected | `/exam` |
| Protected, dynamic | `/exam/[examId]` |
| Protected | `/exam-coverage` |
| Static shell | `/offline-practice.html` (account-scoped package access) |
| Static fallback | `/offline.html` (network recovery and downloaded-practice link) |

History, reviews, daily plan, registration and profile controls are embedded in
these real screens. There are no separate `/history`, `/dashboard`, `/register`,
password recovery or settings pages. Guests redirect to `/login`; active exams
redirect learning-road/rule entry to the saved exam under the existing policy.

## Reproduce the smoke suite

Use the repository's configured PostgreSQL/math service and an initialized bank,
and an installed Playwright Chromium. No new browser framework dependency was added.

```powershell
$env:NEXT_BUILD_DIR = '.next-smoke'
npm run build
npm run start -- --port 3100
# In another terminal:
npm run test:ui:smoke
```

`NEXT_BUILD_DIR` separates the production smoke build from a development server
already using `.next`. Default `npm run build/start/dev` behavior is unchanged.
`CHOICE_TEST_BASE_URL` selects another running server;
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects the browser executable.
`SMOKE_OUTPUT_DIR` changes the screenshot/report directory (default `tmp/ui-smoke`).

The script inventories `app/**/page.tsx` and fails when the route list changes.
It signs in through the actual UI with a disposable registered account, uses
real saved sessions and actual generated exams, and removes its own data in
`finally`. It checks guest protection, landmarks, accessible names, formula
rendering, page overflow, actual links, keyboard controls, errors and recovery.
Screenshots cover 360, 390, 768 and 1440px; selected screens also cover language
switching and dark mode. Existing choice/browser tests separately exercise
offline download, disconnected reload and synchronization with service workers.

Every uncaught `pageerror`, every unexpected `console.error`, and every unexpected
HTTP 404/5xx fails the suite. Only browser resource errors during explicit
503 fault injection are expected; application exceptions are never ignored.

## Execution results

Validated on 2026-10-07 against a production server at `http://127.0.0.1:3100`,
using Next 15.5.26 and installed Playwright Chromium. Integration tests ran
sequentially against a separate local PostgreSQL copy, because existing seed and
migration tests temporarily edit bank content. The server and test processes used
the same isolated `DATABASE_URL`; credentials were never committed. The existing
development server on port 3000 was not used for these runs.
After verification, the temporary production server was stopped and the isolated
database, its dump and temporary credential metadata were removed. Screenshots
and check logs remain under the ignored `tmp/` directory.

| Check | Result |
| --- | --- |
| `npm run lint` | PASS; 13 pre-existing hook dependency warnings remain |
| `npm run typecheck` | PASS |
| 12 unit scripts | PASS: auth, progress, session, skills, plan, exam coverage, exam mode, Kazakh, offline, choices, result analysis, learning road |
| 13 integration/content scripts | PASS: auth, skills, plan, exam coverage, exam math, exam HTTP, exam mode, Kazakh content, Kazakh AI, choice HTTP, choice math, choice migration, road HTTP |
| 3 existing browser scripts | PASS: `test:choices:browser`, `test:analysis:browser`, `test:road:browser` |
| `npm run test:ui:smoke` | PASS against the production build |
| `NEXT_BUILD_DIR=.next-smoke npm run build` | PASS |

Aliases `test:progress`, `test:session` and `test:offline:http` invoke the same
`test:choices:http` script; `test:offline:browser` invokes `test:choices:browser`.
Their underlying suites were executed once per relevant final version.
The math audit checked all 499 practice tasks (five distinct options and a
recomputed answer) plus all 33 authored exam tasks using SymPy.

```text
PASS /login
PASS /
PASS /practice
PASS /practice/session/[sessionId]
PASS /diagnostics
PASS /statistics
PASS /learning-road
PASS /topics
PASS /topics/[topicId]
PASS /learn/rules/[skillId]
PASS /mistakes
PASS /geometry
PASS /exam
PASS /exam/[examId]
PASS /exam-coverage
PASS /offline-practice.html
PASS /offline.html
```

The final smoke run records no unexpected console errors, uncaught exceptions,
or HTTP 404/5xx. Coverage includes guest redirects on all protected routes,
active-exam redirects, account/registration dialog, mobile menu, keyboard focus
and Escape, practice creation/submission/retry recovery/history, a diagnostic
answer through the UI and its completed report, a real 20-question exam with a
saved answer and completion, RU/KK/EN switching, dark mode, and 503 recovery on
statistics, practice setup, mistakes, diagnostics, saved session and result.
The existing offline browser suite verifies download, disconnected restart and
synchronization. AI provider tests use a local mock and make no external AI call.

103 screenshots cover 360/390/768/1440px and extra account/menu/Kazakh states.
Desktop/mobile login, dashboard, practice, result analysis, diagnostic, statistics,
learning road and dialogs were visually inspected. The diagnostic report now
keeps unobserved skills collapsed; labels, formulas and controls remain reachable.
Local artifacts: `tmp/ui-smoke/report.json`, `tmp/ui-smoke/*.png`,
`tmp/result-analysis/`, `tmp/learning-road/` and `tmp/checks/`.

## Problems found by verification

- `/api/learning-road` returned 500 because the local database lacked the
  already-committed learning-road tables. Applied the existing additive
  `prisma/updates/20261006_adaptive_learning_road.sql` before creating the test
  database; no schema redesign or data reset.
- Chromium requested `/favicon.ico` while metadata was still loading. Explicit
  icon metadata and a redirect to the existing `/icon.svg` remove that 404.
- A hidden Recharts tooltip extended the populated statistics page by 11px at
  360px. Chart-local containment and wrapping tooltip text fix the overflow;
  chart animation is disabled to avoid misleading intermediate values.
- Legacy RU/KK question expressions were plain text. The display adapter now
  formats those spans through the existing formatter without altering grading.
- Repeated production document loads exposed a React hydration race: the page
  slot could still be lazy when its `<main>` host completed hydration with no
  child fibers. `DashboardShell` resolves that slot through `Children.toArray`
  before rendering the landmark. The regression suite repeats statistics and
  mistakes navigation/recovery; the dedicated reproduction also completed 20
  navigations without a hydration error. Authentication remains server-provided.
- Three old tests predated stable five-choice IDs and pre-answer AI restrictions.
  Exam HTTP/Kazakh tests now submit the current step and option IDs, including
  explicit session advancement. The AI test asserts the authored choice hint
  and zero provider requests, then tests the legacy provider flow using its own
  disposable question. Original language, scoring, persistence and error
  assertions remain; no tests were skipped or made to accept a failed response.
- Smoke assertions distinguish Next's hidden route announcer from application
  error alerts, wait for server-acknowledged exam choices and ResizeObserver
  layout, and check modal bounds after their opening transition.

## Remaining limitations

- The 13 existing React hook warnings are unchanged; resolving them requires a
  separate review of state and persistence lifecycles.
- Educational content and some diagnostics/exam interface text still use the
  existing Russian fallback in English mode. RU/KK content and all three
  interface selectors retain their current behavior.
- The existing exam-bank audit reports insufficient variety for multiple
  independent full papers; creating one valid 20-question paper is verified.
- Browser coverage is Chromium at the stated widths, not a full WCAG audit or
  testing on physical Safari/Firefox/mobile devices. External production
  deployment, a real AI provider and mail delivery were not exercised.
