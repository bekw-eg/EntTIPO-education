import { PrismaClient } from "@prisma/client";
import {
  generateRootsAndPowers,
  generatePolynomials,
  generateComplexNumbers,
  generateDerivative,
  generateTangent,
  generateIntegrals,
  generateLogarithms,
  generateTrigonometry,
  generateDiffEq2,
  generateStereometry,
  GeneratedQuestion,
} from "../lib/questionGenerator";
import { questionFingerprint } from "../lib/exam/fingerprint";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Question Pool Expansion (Target: 200+ detailed problems)...");

  // Fetch all existing topics
  const topics = await prisma.topic.findMany({ select: { id: true, name: true } });
  console.log(`Found ${topics.length} existing topics in database.`);

  const topicIds = topics.map((t) => t.id);

  // Generate questions for each generator
  const generatorsByTopic: Record<string, ((idx: number) => GeneratedQuestion)[]> = {
    t1: [generateRootsAndPowers],
    t2: [generatePolynomials],
    t3: [generateComplexNumbers],
    t4: [generateDerivative],
    t5: [generateTangent],
    t7: [generateIntegrals],
    t9: [generateLogarithms],
    t11: [generateTrigonometry],
    t14: [generateDiffEq2],
    exam_volumes: [generateStereometry],
  };

  const allQuestionsToInsert: GeneratedQuestion[] = [];

  // Generate 15-20 variations per topic
  for (const topicId of topicIds) {
    const topicGenerators = generatorsByTopic[topicId] || [];

    for (let i = 1; i <= 14; i++) {
      for (const gen of topicGenerators) {
        const q = gen(i);
        allQuestionsToInsert.push(q);
      }
    }
  }

  console.log(`Generated ${allQuestionsToInsert.length} questions in memory.`);

  // Exact content duplicates are skipped even if older rows have random IDs.
  const existing = await prisma.question.findMany({ include: { skills: true, steps: { include: { options: true } } } });
  const hashes = new Set(existing.map(questionFingerprint));
  let insertedCount = 0;
  for (const q of allQuestionsToInsert) {
    const hash = questionFingerprint({ ...q, id: "", latex: q.latex ?? null, purpose: "practice", skills: [] });
    if (hashes.has(hash)) continue;
    try {
      await prisma.question.upsert({
        where: { id: `pool_${hash}` }, update: {}, create: {
          id: `pool_${hash}`,
          topicId: q.topicId,
          title: q.title,
          questionText: q.questionText,
          latex: q.latex,
          difficulty: q.difficulty,
          correctAnswer: q.correctAnswer,
          answerType: q.answerType,
          explanation: q.explanation,
          skills: q.skillIds ? { create: q.skillIds.map((skillId) => ({ skillId })) } : undefined,
          steps: {
            create: q.steps.map((s) => ({
              order: s.order,
              type: s.type,
              prompt: s.prompt,
              expectedAnswer: s.expectedAnswer,
              hint: s.hint,
              skills: s.skillIds ? { create: s.skillIds.map((skillId) => ({ skillId })) } : undefined,
              options: {
                create: s.options.map((opt) => ({
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                  order: opt.order,
                })),
              },
            })),
          },
        },
      });
      hashes.add(hash);
      insertedCount++;
    } catch (err) {
      console.error("Failed to insert question:", err);
    }
  }

  const totalInDb = await prisma.question.count();
  console.log(`\n🎉 Question Pool Scaling Complete!`);
  console.log(`✅ Newly inserted questions: ${insertedCount}`);
  console.log(`📊 Total questions now in database: ${totalInDb}`);
}

main()
  .catch((e) => {
    console.error("Error scaling question bank:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
