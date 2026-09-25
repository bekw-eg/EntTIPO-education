import { PrismaClient } from '@prisma/client';
import katex from 'katex';

const prisma = new PrismaClient();

async function main() {
  const lessons = await prisma.lesson.findMany({
    select: { topicId: true, title: true, formulaLatex: true, formula: true }
  });

  console.log(`Found ${lessons.length} lessons`);
  for (const l of lessons) {
    if (l.formulaLatex) {
      try {
        const rendered = katex.renderToString(l.formulaLatex, { throwOnError: true, displayMode: true });
        console.log(`[OK] ${l.topicId}: ${l.title} -> formula renders successfully (${rendered.length} chars)`);
      } catch (err: any) {
        console.error(`[ERROR] ${l.topicId}: ${l.title} -> KaTeX error:`, err.message, 'Formula was:', l.formulaLatex);
      }
    } else {
      console.log(`[NO LATEX] ${l.topicId}: ${l.title}`);
    }
  }

  const questions = await prisma.question.findMany({
    select: { id: true, title: true, latex: true }
  });
  console.log(`\nFound ${questions.length} questions`);
  for (const q of questions) {
    if (q.latex) {
      try {
        katex.renderToString(q.latex, { throwOnError: true, displayMode: false });
        console.log(`[OK] Q ${q.id}: latex renders successfully`);
      } catch (err: any) {
        console.error(`[ERROR] Q ${q.id}: KaTeX error:`, err.message, 'LaTeX was:', q.latex);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
