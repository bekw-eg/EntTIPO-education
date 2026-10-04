import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma';
import { AUTH_COOKIE_NAME, createSessionToken } from '../lib/auth';
import { POST } from '../app/api/ai/tutor/route';
import { FALLBACK_MESSAGES } from '../lib/ai/gemini';

const email = `kazakh-ai-${randomUUID()}@example.test`;
let userId: string | undefined;
const realFetch = globalThis.fetch, oldKey = process.env.GEMINI_API_KEY;
let reply = '', requests: any[] = [];
async function invoke(action: string) {
  const request = new NextRequest('http://localhost/api/ai/tutor', { method: 'POST', headers: {
    cookie: `${AUTH_COOKIE_NAME}=${createSessionToken(userId!)}; ent_tipo_locale=kk`, 'Content-Type': 'application/json',
  }, body: JSON.stringify({ action, language: 'kk', questionId: 'practice_power_product', userAnswer: 'x^6' }) });
  const response = await POST(request); return { status: response.status, data: await response.json() };
}
async function main() {
  userId = (await prisma.user.create({ data: { email, name: 'Disposable Kazakh AI fixture' } })).id;
  const question = await prisma.question.findUniqueOrThrow({ where: { id: 'practice_power_product' } });
  process.env.GEMINI_API_KEY = 'local-provider-fixture';
  globalThis.fetch = async (input, init) => {
    assert.ok(String(input).startsWith('https://generativelanguage.googleapis.com/'), 'Never proxy real network traffic in this fixture');
    requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: reply }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  reply = 'Негіздері бірдей дәрежелерді көбейткенде көрсеткіштерін қосыңыз.';
  const hint = await invoke('hint'); assert.equal(hint.status, 200); assert.equal(hint.data.text, reply);
  assert.ok(requests[0].systemInstruction.parts[0].text.includes('ҚАЗАҚ ТІЛІНДЕ'));
  assert.ok(requests[0].contents[0].parts[0].text.includes(question.questionTextKk));
  assert.ok(!requests[0].contents[0].parts[0].text.includes(question.questionText));
  const analysis = { errorType: 'concept_error', weakSkill: 'Дәрежелердің қасиеттері',
    reason: 'Көрсеткіштерді қосу ережесі дұрыс қолданылмаған.', shortExplanation: '4+3=7, сондықтан x^7 шығады.',
    hint: 'Бірдей негіздерді сақтаңыз.', recommendedAction: 'repeat_theory', recommendedDifficulty: 2 };
  reply = JSON.stringify(analysis);
  const result = await invoke('analyze_error'); assert.equal(result.status, 200); assert.deepEqual(result.data.structuredError, analysis);
  const mistake = await prisma.mistake.findFirstOrThrow({ where: { userId }, orderBy: { createdAt: 'desc' } });
  assert.deepEqual((mistake.aiAnalysisLocales as any).kk, analysis);
  // A malformed structured response receives authored Kazakh explanation/hint defaults.
  reply = JSON.stringify({ unrelatedKey: true });
  const malformed = await invoke('analyze_error'); assert.equal(malformed.status, 200);
  assert.equal(malformed.data.structuredError.shortExplanation, question.explanationKk);
  assert.match(malformed.data.structuredError.reason, /Ережені/);
  const priorCount = await prisma.mistake.count({ where: { userId } });
  requests = []; reply = 'Сначала найдите производную. Затем подставьте число.';
  const rejected = await invoke('explain'); assert.equal(rejected.status, 500);
  assert.equal(rejected.data.error, FALLBACK_MESSAGES.kk);
  assert.equal(requests.length, 6, 'Wrong-language responses are rejected on every provider/model retry');
  assert.equal(await prisma.mistake.count({ where: { userId } }), priorCount);
  delete process.env.GEMINI_API_KEY;
  const offline = await invoke('chat'); assert.equal(offline.status, 500); assert.equal(offline.data.error, FALLBACK_MESSAGES.kk);
  console.log('PASS: localized AI context/system instruction, Kazakh hint and analysis, locale-specific persisted analysis, malformed JSON defaults, Russian-response rejection and translated provider-unavailable fallback. No external AI call was made.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  globalThis.fetch = realFetch;
  if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
  if (userId && await prisma.user.findFirst({ where: { id: userId, email } })) {
    await prisma.mistake.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId, email } });
  }
  await prisma.$disconnect();
});
