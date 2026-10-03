import { prisma } from "../lib/prisma";
import { callGemini } from "../lib/ai/gemini";
import {
  buildHintPrompt,
  buildExplainConditionPrompt,
  buildWhyFormulaPrompt,
  buildErrorAnalysisPrompt,
  buildExplainFormulaPrompt,
  buildSimilarQuestionPrompt,
} from "../lib/ai/prompts";
import { aiErrorAnalysisSchema, aiSimilarQuestionSchema } from "../lib/validators";

async function runTests() {
  console.log("=== STARTING AI TUTOR INTEGRATION TESTS ===\n");

  // 1. Fetch a real question from the database
  const question = await prisma.question.findFirst({
    include: { topic: true, subtopic: true, steps: true },
  });

  if (!question) {
    console.error("No questions found in database!");
    process.exit(1);
  }

  console.log(`Testing with Question: "${question.title}" (Topic: ${question.topic.name})`);

  const questionContext = {
    id: question.id,
    title: question.title,
    questionText: question.questionText,
    latex: question.latex,
    difficulty: question.difficulty,
    topicName: question.topic.name,
    subtopicName: question.subtopic?.name,
    correctAnswer: question.correctAnswer,
  };

  const userContext = {
    language: "ru" as const,
    masteryScore: 45,
    currentLevel: 2,
    userAnswer: "4",
  };

  // Test 1: Level 1 Hint (RU)
  console.log("\n[Test 1] Level 1 Hint (Russian)...");
  const hintPrompt = buildHintPrompt(questionContext, userContext, 1);
  const hintResponse = await callGemini(hintPrompt.system, hintPrompt.user);
  console.log("Hint (Level 1) Output:", hintResponse.slice(0, 180) + "...");

  // Test 2: Level 1 Hint (KZ)
  console.log("\n[Test 2] Level 1 Hint (Kazakh)...");
  const kzUserContext = { ...userContext, language: "kk" as const };
  const kzHintPrompt = buildHintPrompt(questionContext, kzUserContext, 1);
  const kzHintResponse = await callGemini(kzHintPrompt.system, kzHintPrompt.user);
  console.log("Hint KZ (Level 1) Output:", kzHintResponse.slice(0, 180) + "...");

  // Test 3: Explain Condition
  console.log("\n[Test 3] Explain Condition...");
  const explainPrompt = buildExplainConditionPrompt(questionContext, userContext);
  const explainResponse = await callGemini(explainPrompt.system, explainPrompt.user);
  console.log("Explain Condition Output:", explainResponse.slice(0, 180) + "...");

  // Test 4: Explain Formula
  console.log("\n[Test 4] Explain Formula (Түсінбедім)...");
  const formulaPrompt = buildExplainFormulaPrompt(
    "a^m \\cdot a^n = a^{m+n}",
    "Умножение степеней",
    question.topic.name,
    userContext
  );
  const formulaResponse = await callGemini(formulaPrompt.system, formulaPrompt.user);
  console.log("Explain Formula Output:", formulaResponse.slice(0, 180) + "...");

  // Test 5: Structured Error Analysis
  console.log("\n[Test 5] Structured Error Analysis (JSON mode)...");
  const errorPrompt = buildErrorAnalysisPrompt(questionContext, userContext);
  const rawErrorJson = await callGemini(errorPrompt.system, errorPrompt.user, { jsonMode: true });
  let parsedError: any;
  try {
    parsedError = JSON.parse(rawErrorJson);
  } catch {
    parsedError = JSON.parse(rawErrorJson.replace(/```json\s*|```/g, "").trim());
  }
  const validatedError = aiErrorAnalysisSchema.safeParse(parsedError);
  console.log("Validated Error Analysis:", validatedError.success ? "SUCCESS" : "FAILED", validatedError.data || validatedError.error);

  // Test 6: Similar Question Generation
  console.log("\n[Test 6] Similar Practice Question (JSON mode)...");
  const simPrompt = buildSimilarQuestionPrompt(questionContext, userContext);
  const rawSimJson = await callGemini(simPrompt.system, simPrompt.user, { jsonMode: true });
  let parsedSim: any;
  try {
    parsedSim = JSON.parse(rawSimJson);
  } catch {
    parsedSim = JSON.parse(rawSimJson.replace(/```json\s*|```/g, "").trim());
  }
  const validatedSim = aiSimilarQuestionSchema.safeParse(parsedSim);
  console.log("Validated Similar Question:", validatedSim.success ? "SUCCESS" : "FAILED", validatedSim.data || validatedSim.error);

  console.log("\n=== ALL AI TESTS COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
