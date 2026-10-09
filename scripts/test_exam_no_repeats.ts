import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { TIPO_MATH } from '../lib/exam/profile';
import { readExamAvailability } from '../lib/exam/session';
import { mathematicalStemKey, unusedCandidates } from '../lib/exam/history';
import type { PaperQuestion } from '../lib/exam/mode';
import { GENERATED_IDENTITIES, VERIFIED_EXERCISES, LEGACY_MATH_ALIASES } from '../lib/exam/generated-bank';

const db = new PrismaClient(), base=process.env.EXAM_TEST_BASE_URL??'http://127.0.0.1:3100';
const accounts:{id:string;cookie:string;email:string}[]=[];
async function api(path:string,cookie:string,method='GET',body?:unknown) {
  const r=await fetch(base+path,{method,headers:{cookie,'Content-Type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
  return {status:r.status,data:await r.json(),response:r};
}
async function account() {
  const email=`no-repeats-${randomUUID()}@example.test`;
  const r=await api('/api/auth/register','','POST',{name:'Repeat test',email,password:'repeat-test-password-123'});
  assert.equal(r.status,200,JSON.stringify(r.data));
  const a={id:r.data.user.id as string,email,cookie:r.response.headers.get('set-cookie')!.split(';')[0]};accounts.push(a);return a;
}
const settings=(language='ru')=>({requestId:randomUUID(),profileId:TIPO_MATH.id,profileVersion:TIPO_MATH.version,language,durationMinutes:40});
async function historical(userId:string,ids:string[],status='completed',paper:unknown[]=[]) {
  return db.examSession.create({data:{userId,startRequestId:randomUUID(),startHash:'pre-implementation-fixture',
    profileId:TIPO_MATH.id,profileVersion:TIPO_MATH.version,profileSnapshot:JSON.parse(JSON.stringify(TIPO_MATH)),
    language:'ru',questionIds:ids,paper:JSON.parse(JSON.stringify(paper)),status:'completed',completionReason:status==='abandoned'?'timeout':'student',startedAt:new Date(0),deadlineAt:new Date(1),
    durationMinutes:40,result:{points:0,maxPoints:20}}});
}
async function main() {
  const a=await account(),b=await account();
  const used=new Set<string>();
  let firstPaper:PaperQuestion[]=[];
  for(let round=0;round<6;round++) {
    const body=settings(round%2?'kk':'ru');
    const secondBody=settings(body.language);
    const starts=await Promise.all([api('/api/exams',a.cookie,'POST',body),api('/api/exams',a.cookie,'POST',secondBody)]);
    for(const r of starts) assert.equal(r.status,200,JSON.stringify(r.data));
    assert.equal(starts[0].data.id,starts[1].data.id,'Two tabs must share the active attempt');
    const id=starts[0].data.id;
    const row=await db.examSession.findUniqueOrThrow({where:{id}}),paper=row.paper as unknown as PaperQuestion[];
    assert.equal(new Set(paper.map(q=>q.family)).size,20);
    for(const q of paper) { assert.ok(q.mathKey); assert.ok(!used.has(q.mathKey),`Repeated ${q.id}`);used.add(q.mathKey); }
    const resumed=await api('/api/exams',a.cookie,'POST',settings(body.language==='ru'?'kk':'ru'));
    assert.equal(resumed.data.id,id); assert.deepEqual(resumed.data.questions,starts[0].data.questions);
    if(round===0) firstPaper=paper;
    if(round===1) {
      // Closed browser: no finish call. DB deadline, list/read, then next start.
      await db.examSession.update({where:{id},data:{startedAt:new Date(0),deadlineAt:new Date(1)}});
      assert.equal((await api(`/api/exams/${id}`,a.cookie)).data.status,'completed');
    } else assert.equal((await api(`/api/exams/${id}/finish`,a.cookie,'POST',{})).status,200);
    const replay=await api('/api/exams',a.cookie,'POST',body);assert.equal(replay.data.id,id);
    assert.equal((await api('/api/exams',a.cookie,'POST',secondBody)).data.id,id,'Losing tab replay must not create a new attempt');
  }
  // Different accounts may receive precisely the same mathematical paper.
  // Reserve every other task for B, leaving A's original valid blueprint.
  const available=await db.$transaction(tx=>readExamAvailability(tx,TIPO_MATH,'ru'),{timeout:30000});
  const firstIds=new Set(firstPaper.map(q=>q.id));
  await historical(b.id,available.candidates.filter(q=>!firstIds.has(q.id)).map(q=>q.id),'abandoned');
  const shared=await api('/api/exams',b.cookie,'POST',settings());assert.equal(shared.status,200,JSON.stringify(shared.data));
  assert.deepEqual(new Set(shared.data.questions.map((q:PaperQuestion)=>q.id)),firstIds);
  await api(`/api/exams/${shared.data.id}/finish`,b.cookie,'POST',{});
  // Legacy snapshot has no mathKey; original IDs and frozen text still reserve it.
  const remaining=await db.$transaction(tx=>readExamAvailability(tx,TIPO_MATH,'ru',a.id),{timeout:30000});
  const legacy=remaining.candidates[0];
  await historical(a.id,[legacy.id],'abandoned');
  const afterLegacy=await db.$transaction(tx=>readExamAvailability(tx,TIPO_MATH,'kk',a.id),{timeout:30000});
  assert.ok(!afterLegacy.candidates.some(q=>q.id===legacy.id));
  // A withdrawn inverse-trig formulation must reserve its admitted equivalent.
  const alias=[...GENERATED_IDENTITIES.values()].find(q=>q.verification.result==='duplicate'&&q.family==='v2_02_arccos'&&afterLegacy.candidates.some(c=>c.mathKey===q.mathKey));
  assert.ok(alias,'Expected an unused withdrawn arccos alias');
  await historical(a.id,[alias.id]);
  const afterAlias=await db.$transaction(tx=>readExamAvailability(tx,TIPO_MATH,'ru',a.id),{timeout:30000});
  assert.ok(!afterAlias.candidates.some(q=>q.mathKey===alias.mathKey));
  // Exhaust only one required point. Other sections still contain new questions.
  const exhausted=afterLegacy.candidates.filter(q=>q.pointCode==='19');
  await historical(a.id,exhausted.map(q=>q.id));
  const before=await db.examSession.count({where:{userId:a.id}});
  const refusal=await api('/api/exams',a.cookie,'POST',settings());
  assert.equal(refusal.status,422,JSON.stringify(refusal.data));assert.match(refusal.data.error,/19/);
  assert.equal(await db.examSession.count({where:{userId:a.id}}),before);
  const audits=await db.$queryRaw<{details:unknown}[]>`SELECT "details" FROM "ExamBankAudit" WHERE "userId"=${a.id}`;
  assert.equal(audits.length,1);assert.match(JSON.stringify(audits[0].details),/19/);
  assert.equal((await api('/api/exams',a.cookie)).status,200);
  const availability=await api('/api/exams/availability',a.cookie);
  availability.data.languages.forEach((l:{canGenerate:boolean;missingPointCodes:string[]})=>{assert.equal(l.canGenerate,false);assert.ok(l.missingPointCodes.includes('19'));});
  // Formatting, answer permutation, translation and aliases cannot evade keys.
  const stem=mathematicalStemKey('Найдите x: 2x − 4 = 0.');
  assert.equal(stem,mathematicalStemKey(' Найдите x : 2x - 4 = 0! '));
  const candidate={id:'alias',contentHash:'changed-options',mathKey:'same-math',family:'family',pointCode:'01',band:'B' as const};
  assert.deepEqual(unusedCandidates([candidate],[{questionIds:['old'],paper:[{id:'old',mathKey:'same-math',family:'family'}]}],new Map()),[]);
  const oldStem=unusedCandidates([{...candidate,mathKey:stem}],[{questionIds:[],paper:[{questionText:'Найдите x: 2x − 4 = 0.'}]}],new Map());assert.equal(oldStem.length,0);
  assert.equal(new Set(VERIFIED_EXERCISES.map(q=>q.mathKey)).size,VERIFIED_EXERCISES.length);
  const legacyAliasKey=LEGACY_MATH_ALIASES.get('exam_v1_root_absolute')!;
  assert.equal(legacyAliasKey,GENERATED_IDENTITIES.get('exam_v2_06_absolute_005')!.mathKey);
  const oldIdentity=new Map([['exam_v1_root_absolute',{mathKey:legacyAliasKey,stemKey:'old-ru-stem'}]]);
  assert.deepEqual(unusedCandidates([{...candidate,mathKey:legacyAliasKey}],
    [{questionIds:['exam_v1_root_absolute'],paper:[]}],oldIdentity),[]);
  console.log('PASS: six RU/KK papers, all-status history, legacy reservation, frozen resume, shared bank across accounts, concurrent starts, request replay, topic exhaustion, durable audit and answer-independent identities.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  for(const a of accounts) {
    await db.$executeRaw`DELETE FROM "ExamBankAudit" WHERE "userId"=${a.id}`;
    await db.dailyGoal.deleteMany({where:{userId:a.id}});
    await db.user.deleteMany({where:{id:a.id,email:a.email}});
  }
  await db.$disconnect();
});
