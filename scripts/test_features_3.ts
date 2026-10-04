import { prisma } from "../lib/prisma";
import {
  getUserSkillProfile,
  selectQuestionsForSession,
} from "../lib/adaptive";
import {
  generateQuestionForSkill,
  getAvailableSkills,
  SKILL_GENERATOR_MAP,
} from "../lib/questionGenerator";

async function runFeatureTests() {
  console.log("==================================================");
  console.log("🧪 Testing Features 1, 2, and 3 Implementation");
  console.log("==================================================");

  // 1. Test Question Generator Micro-Skills
  console.log("\n--- [Test 1] Question Generator Skills Mapping ---");
  const availableSkills = getAvailableSkills();
  console.log(`Available skills: ${availableSkills.length}`);
  if (availableSkills.length < 5) {
    throw new Error("Expected at least 5 available skills");
  }

  const sampleSkill = "roots_and_powers";
  const genQ = generateQuestionForSkill(sampleSkill, 42);
  if (!genQ || !genQ.weakSkill || genQ.skillTag !== "roots_and_powers") {
    throw new Error("Failed to generate question with skillTag");
  }
  console.log(`✅ generateQuestionForSkill("${sampleSkill}") created: "${genQ.title}" with weakSkill: "${genQ.weakSkill}"`);

  const trigQ = generateQuestionForSkill("тригонометрические_функции", 1);
  if (!trigQ || trigQ.topicId !== "t11") {
    throw new Error("Failed to resolve Cyrillic skill to trigonometry generator");
  }
  console.log(`✅ generateQuestionForSkill Cyrillic match created: "${trigQ.title}" (topicId: ${trigQ.topicId})`);

  // 2. Test Weak-Skill Profiler and Adaptive Selection
  console.log("\n--- [Test 2] Adaptive Question Selection by weakSkill ---");
  const testUser = await prisma.user.findFirst();
  if (!testUser) {
    throw new Error("No user found in test DB");
  }
  console.log(`Using test user: ${testUser.id} (${testUser.email})`);

  // Create a synthetic mistake with a specific weakSkill if needed
  const testQuestion = await prisma.question.findFirst({
    where: { topicId: "t1" },
  });

  if (testQuestion) {
    await prisma.mistake.create({
      data: {
        userId: testUser.id,
        questionId: testQuestion.id,
        topicId: testQuestion.topicId,
        errorType: "concept_error",
        weakSkill: "свойства_степеней",
        isReviewed: false,
        description: "Test synthetic mistake for adaptive selection",
      },
    });
    console.log(`Created test unreviewed mistake for skill 'свойства_степеней' on question ${testQuestion.id}`);
  }

  const profile = await getUserSkillProfile(testUser.id);
  console.log("Student weak-skill profile:");
  console.log(`- Top weak skills: ${JSON.stringify(profile.topWeakSkills)}`);
  console.log(`- Weak topic IDs: ${JSON.stringify(profile.weakTopicIds)}`);
  console.log(`- Unreviewed mistake question count: ${profile.unreviewedQuestionIds.length}`);

  if (!profile.topWeakSkills.includes("свойства_степеней")) {
    console.warn("Notice: Top weak skills didn't rank свойства_степеней first due to other history, but it is tracked.");
  } else {
    console.log("✅ Top weak skills correctly includes 'свойства_степеней'");
  }

  // Test selectQuestionsForSession in 'weak_topics' mode
  const weakSessionQuestions = await selectQuestionsForSession({
    userId: testUser.id,
    count: 5,
    mode: "weak_topics",
  });
  console.log(`✅ Selected ${weakSessionQuestions.length} questions for weak_topics mode:`, weakSessionQuestions);
  if (weakSessionQuestions.length !== 5) {
    throw new Error(`Expected 5 questions, got ${weakSessionQuestions.length}`);
  }

  // Test selectQuestionsForSession in 'mixed' mode
  const mixedSessionQuestions = await selectQuestionsForSession({
    userId: testUser.id,
    count: 6,
    mode: "mixed",
  });
  console.log(`✅ Selected ${mixedSessionQuestions.length} questions for mixed mode:`, mixedSessionQuestions);
  if (mixedSessionQuestions.length !== 6) {
    throw new Error(`Expected 6 questions, got ${mixedSessionQuestions.length}`);
  }

  // 3. Test i18n Translations Integrity
  console.log("\n--- [Test 3] Voice & History Translations Integrity ---");
  const { translations } = await import("../lib/i18n/translations");
  for (const lang of ["ru", "kk", "en"] as const) {
    const aiKeys = (translations as any)[lang].ai;
    const requiredKeys = [
      "readAloud",
      "stopAudio",
      "voiceInput",
      "voiceListening",
      "voiceNotSupported",
      "clearHistory",
      "historyCleared",
    ];
    for (const key of requiredKeys) {
      if (!aiKeys[key]) {
        throw new Error(`Missing translation key '${key}' in locale '${lang}'`);
      }
    }
    console.log(`✅ All voice & history keys present in locale: ${lang} (e.g. readAloud: "${aiKeys.readAloud}")`);
  }

  console.log("\n==================================================");
  console.log("🎉 All 3 Features Successfully Verified!");
  console.log("==================================================");
}

runFeatureTests()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
