import katex from "katex";
import { translations, topicNamesTranslations, errorTypeTranslations } from "../lib/i18n/translations";
import { topicLessons, getLocalizedLesson } from "../lib/i18n/lessons";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";
const MATH_URL = "http://localhost:8001";

interface AuditResult {
  category: string;
  test: string;
  status: "PASS" | "FAIL";
  details?: string;
}

const results: AuditResult[] = [];

function record(category: string, test: string, passed: boolean, details?: string) {
  results.push({
    category,
    test,
    status: passed ? "PASS" : "FAIL",
    details,
  });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [${category}] ${test} ${details ? `(${details})` : ""}`);
}

async function testHttpEndpoint(path: string, expectedStatus = 200) {
  try {
    const res = await fetch(`${BASE_URL}${path}`);
    const ok = res.status === expectedStatus;
    record("Web Pages", `GET ${path}`, ok, `Status: ${res.status}`);
    return ok;
  } catch (err: any) {
    record("Web Pages", `GET ${path}`, false, `Network error: ${err.message}`);
    return false;
  }
}

async function testApiEndpoint(path: string) {
  try {
    const res = await fetch(`${BASE_URL}${path}`);
    const ok = res.status === 200;
    if (ok) {
      const data = await res.json();
      record("API Endpoints", `GET ${path}`, true, `Returned valid JSON`);
      return data;
    } else {
      record("API Endpoints", `GET ${path}`, false, `Status ${res.status}`);
      return null;
    }
  } catch (err: any) {
    record("API Endpoints", `GET ${path}`, false, `Error: ${err.message}`);
    return null;
  }
}

async function auditTranslations() {
  console.log("\n=== 1. AUDITING TRANSLATIONS ===");
  const locales = ["ru", "kk", "en"] as const;

  // Check Schema keys
  for (const loc of locales) {
    const t = translations[loc];
    const hasCommon = !!t?.common?.appName && !!t?.common?.loading;
    const hasNav = !!t?.nav?.home && !!t?.nav?.practice && !!t?.nav?.topics && !!t?.nav?.mistakes && !!t?.nav?.statistics;
    const hasDashboard = !!t?.dashboard?.todayTasks && !!t?.dashboard?.weakTopics;
    const hasPractice = !!t?.practice?.setupTitle && !!t?.practice?.modes?.mixed?.title;
    const hasSession = !!t?.session?.checkSolution && !!t?.session?.solutionSteps;
    const hasResult = !!t?.result?.greatJob && !!t?.result?.hasErrors;
    const hasTopics = !!t?.topics?.catalogTitle && !!t?.topics?.theory;
    const hasLesson = !!t?.lesson?.whatIsIt && !!t?.lesson?.keyFormula && !!t?.lesson?.commonErrors;
    const hasMistakes = !!t?.mistakes?.title && !!t?.mistakes?.unreviewedTab;
    const hasStatistics = !!t?.statistics?.title && !!t?.statistics?.accuracyLabel;

    const allPresent = hasCommon && hasNav && hasDashboard && hasPractice && hasSession && hasResult && hasTopics && hasLesson && hasMistakes && hasStatistics;
    record("Translations Schema", `All sections populated for '${loc}'`, allPresent);
  }

  // Check Topic Names
  const expectedTopics = [
    "Корни и степени",
    "Многочлены",
    "Комплексные числа",
    "Производная",
    "Касательная к графику",
    "Первообразная",
    "Интегралы",
    "Экспоненциальные интегралы",
    "Логарифмические функции",
    "Показательные функции",
    "Тригонометрия",
    "Обратные тригонометрические функции",
    "ДУ первого порядка",
    "ДУ второго порядка",
    "Дробно-линейные функции"
  ];

  for (const name of expectedTopics) {
    const entry = topicNamesTranslations[name];
    const valid = !!entry && !!entry.ru && !!entry.kk && !!entry.en;
    record("Topic Names i18n", `Topic '${name}' translated in RU, KK, EN`, valid, entry ? `KK: ${entry.kk} | EN: ${entry.en}` : "Missing");
  }

  // Check Error Types
  const errorTypes = [
    "wrong_formula",
    "calculation_error",
    "sign_error",
    "algebra_error",
    "domain_error",
    "concept_error",
    "incorrect_method"
  ];
  for (const et of errorTypes) {
    const entry = errorTypeTranslations[et];
    const valid = !!entry && !!entry.ru && !!entry.kk && !!entry.en;
    record("Error Types i18n", `Error type '${et}' translated in RU, KK, EN`, valid);
  }
}

async function auditLessonsAndFormulas() {
  console.log("\n=== 2. AUDITING 15 TOPIC LESSONS & FORMULAS ===");
  const locales = ["ru", "kk", "en"] as const;

  for (let i = 1; i <= 15; i++) {
    const topicId = `t${i}`;
    for (const loc of locales) {
      const lesson = getLocalizedLesson(topicId, loc);
      const exists = !!lesson && !!lesson.title && !!lesson.whatIsIt && !!lesson.whenUsed && !!lesson.example && !!lesson.commonErrors;
      record("Lesson Content", `${topicId} [${loc}] complete theory`, exists, lesson?.title);

      if (lesson?.formulaLatex) {
        try {
          const rendered = katex.renderToString(lesson.formulaLatex, {
            throwOnError: true,
            displayMode: true,
          });
          record("KaTeX Formula", `${topicId} [${loc}] LaTeX renders validly`, rendered.length > 0);
        } catch (err: any) {
          record("KaTeX Formula", `${topicId} [${loc}] LaTeX renders validly`, false, err.message);
        }
      }
    }
  }
}

async function auditMathService() {
  console.log("\n=== 3. AUDITING MATH MICROSERVICE ===");
  try {
    const health = await fetch(`${MATH_URL}/health`);
    const isOk = health.status === 200;
    record("Math Service", "GET /health is 200 OK", isOk);

    // Test expression equivalence
    const exprRes = await fetch(`${MATH_URL}/validate-expression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userExpression: "(sqrt(75) - sqrt(48)) / sqrt(3)",
        expectedExpression: "1",
        variables: []
      })
    });
    const exprData = await exprRes.json();
    record("Math Service", "SymPy: (sqrt(75)-sqrt(48))/sqrt(3) == 1", exprData.isEquivalent === true);

    // Test polynomial equivalence
    const polyRes = await fetch(`${MATH_URL}/validate-expression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userExpression: "(x - 2) * (x - 3)",
        expectedExpression: "x**2 - 5*x + 6",
        variables: ["x"]
      })
    });
    const polyData = await polyRes.json();
    record("Math Service", "SymPy: (x-2)(x-3) == x^2 - 5x + 6", polyData.isEquivalent === true);

    // Test fractional number equivalence
    const numRes = await fetch(`${MATH_URL}/validate-number`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAnswer: "27^(2/3)",
        expectedAnswer: "9"
      })
    });
    const numData = await numRes.json();
    record("Math Service", "SymPy: 27^(2/3) == 9", numData.isEquivalent === true);

  } catch (err: any) {
    record("Math Service", "Connection to Math Service", false, err.message);
  }
}

async function auditWebAndApiRoutes() {
  console.log("\n=== 4. AUDITING NEXT.JS PAGES & API ROUTES ===");
  // Pages
  await testHttpEndpoint("/");
  await testHttpEndpoint("/topics");
  await testHttpEndpoint("/topics/t1");
  await testHttpEndpoint("/topics/t5");
  await testHttpEndpoint("/topics/t13");
  await testHttpEndpoint("/practice");
  await testHttpEndpoint("/mistakes");
  await testHttpEndpoint("/statistics");

  // API Routes
  await testApiEndpoint("/api/dashboard");
  await testApiEndpoint("/api/topics");
  await testApiEndpoint("/api/topics/t1");
  await testApiEndpoint("/api/mistakes");
  await testApiEndpoint("/api/statistics");
}

async function auditV2Features() {
  console.log("\n=== 6. AUDITING V2 RESOLVED FEATURES ===");

  // Feature 1: Offline JS Math Engine (SymPy offline fallback)
  const { validateExpressionOffline, validateNumberOffline } = await import("../lib/mathEngine");
  const exprTest1 = validateExpressionOffline("(x-2)*(x-3)", "x^2 - 5*x + 6");
  record("Offline Math Engine", "Equivalence: (x-2)*(x-3) == x^2 - 5x + 6", exprTest1.isEquivalent);

  const exprTest2 = validateExpressionOffline("sin(x)^2 + cos(x)^2", "1");
  record("Offline Math Engine", "Trig Identity: sin(x)^2 + cos(x)^2 == 1", exprTest2.isEquivalent);

  const numTest1 = validateNumberOffline("1/2", "0.5");
  record("Offline Math Engine", "Fraction & Decimal: 1/2 == 0.5", numTest1.isEquivalent);

  const numTest2 = validateNumberOffline("sqrt(4)", "2");
  record("Offline Math Engine", "Radical: sqrt(4) == 2", numTest2.isEquivalent);

  // Feature 2: Question Pool Scaling (> 200 questions)
  const count = await prisma.question.count();
  record("Question Bank Scaling", `Database has 200+ detailed problems (Actual: ${count})`, count >= 200);

  // Feature 3: Interactive Geometry Studio
  await testHttpEndpoint("/geometry");

  // Feature 4: Multi-User Auth Endpoints
  const testStudentEmail = `audit_student_${Date.now()}@example.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Audit Student",
      email: testStudentEmail,
      password: "securePassword123",
    }),
  });
  const regData = await regRes.json();
  const regOk = regRes.status === 200 && !!regData.token;
  record("Multi-User Auth", "POST /api/auth/register (Create new student)", regOk);

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testStudentEmail,
      password: "securePassword123",
    }),
  });
  const loginData = await loginRes.json();
  const loginOk = loginRes.status === 200 && !!loginData.token;
  record("Multi-User Auth", "POST /api/auth/login (Session creation)", loginOk);

  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  const meData = await meRes.json();
  record("Multi-User Auth", "GET /api/auth/me (Authenticated profile)", meRes.status === 200 && meData.user?.email === testStudentEmail);

  await testApiEndpoint("/api/auth/users");

  // Feature 5: PWA Service Worker & Manifest
  await testHttpEndpoint("/manifest.json");
  await testHttpEndpoint("/sw.js");
  await testHttpEndpoint("/offline.html");
  await testHttpEndpoint("/icon-192.png");
  await testHttpEndpoint("/icon-512.png");
}

async function auditPracticeFlow() {
  console.log("\n=== 5. AUDITING PRACTICE SESSION & ATTEMPT FLOW ===");
  try {
    const sessRes = await fetch(`${BASE_URL}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "specific_topic", totalCount: 2, topicId: "t1" })
    });
    const session = await sessRes.json();
    const sessionOk = sessRes.status === 200 && !!session.id && Array.isArray(session.questionIds);
    record("Practice Flow", "Create practice session (POST /api/sessions)", sessionOk, `Session ID: ${session.id}`);

    if (sessionOk && session.questionIds.length > 0) {
      const qRes = await fetch(`${BASE_URL}/api/sessions/${session.id}/next-question?questionIds=${session.questionIds.join(",")}&index=0`);
      const q = await qRes.json();
      record("Practice Flow", "Fetch next question with steps", qRes.status === 200 && !!q.id && Array.isArray(q.steps), `Question: ${q.title}`);

      // Submit an attempt
      if (q.steps?.length > 0) {
        const stepAnswers = q.steps.map((s: any) => ({
          stepId: s.id,
          answer: s.expectedAnswer
        }));
        const attRes = await fetch(`${BASE_URL}/api/attempts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: q.id,
            submissionId: crypto.randomUUID(),
            sessionId: session.id,
            stepAnswers,
            timeSpent: 15
          })
        });
        const attempt = await attRes.json();
        record("Practice Flow", "Submit attempt & validate steps (POST /api/attempts)", attRes.status === 200 && attempt.isCorrect === true, `Score: ${attempt.score}%`);
      }
    }
  } catch (err: any) {
    record("Practice Flow", "Practice execution cycle", false, err.message);
  }
}

async function main() {
  console.log("Starting comprehensive operational audit of Synaq platform...");
  await auditTranslations();
  await auditLessonsAndFormulas();
  await auditMathService();
  await auditWebAndApiRoutes();
  await auditPracticeFlow();
  await auditV2Features();

  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log("\n==========================================");
  console.log(`AUDIT SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  if (failed > 0) {
    console.error(`FAILED TESTS: ${failed}`);
    results.filter(r => r.status === "FAIL").forEach(f => {
      console.error(`- [${f.category}] ${f.test}: ${f.details}`);
    });
    process.exit(1);
  } else {
    console.log("🎉 ALL TESTS PASSED PERFECTLY!");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Audit crashed:", err);
  process.exit(1);
});
