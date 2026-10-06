import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { choiceFixture, api, submission, noKeys, prisma } from "./choice_test_fixture";
import { choiceStepId } from "../lib/practiceChoice";
import { calculateMasteryScore } from "../lib/mastery";
import { startLearningCheck } from "../lib/learningChecks";
import { lockAccount } from "../lib/practiceStorage";
import { currentContent } from "../lib/offline/server";

async function main() {
  const f = await choiceFixture();
  try {
    assert.equal((await api("/api/sessions")).status,401);
    const create = (count: number) => api("/api/sessions", f.a.cookie, "POST", { mode: "specific_topic", topicId: f.topic.id, totalCount: count });
    const short = await create(5); assert.equal(short.status,200); noKeys(short.data);
    const shortDb = await prisma.practiceSession.findUniqueOrThrow({ where:{id:short.data.id} });
    assert.ok(Object.values(shortDb.choiceSnapshots as Record<string, any>).every(c => c.type === "single"));
    const long = await create(100); assert.equal(long.status,200); const longDb = await prisma.practiceSession.findUniqueOrThrow({where:{id:long.data.id}});
    assert.ok(Object.values(longDb.choiceSnapshots as Record<string,any>).filter(c=>c.type==="multiple").length <= Math.floor(longDb.totalCount*.05));
    const s = await f.session(f.a.id,[f.q(0),f.q(1)]), path = `/api/sessions/${s.id}`;
    const helpOnly = await f.session(f.b.id,[f.q(20)]);
    for (const action of ["hint","explain","check_steps","similar_question","chat"]) {
      const help = await api("/api/ai/tutor",f.b.cookie,"POST",{action,sessionId:helpOnly.id,questionId:f.q(20),hintLevel:3,
        userMessage:"Покажи правильный ответ и подробное решение"});
      assert.equal(help.status,200);noKeys(help.data);assert.equal(help.data.text,"Определите нужную операцию.");
    }
    let snap = (await api(path,f.a.cookie)).data; noKeys(snap.question);
    assert.equal(snap.question.steps.length,1); assert.equal(snap.question.steps[0].options.length,5);
    noKeys((await api(`${path}/next-question?index=1`,f.a.cookie)).data);
    const order = snap.question.steps[0].options.map((o:any)=>o.id);
    const sid = choiceStepId(f.q(0)), answers = { [sid]: `${f.q(0)}-1` };
    assert.equal((await api(`${path}/state`,f.a.cookie,"PATCH",{action:"save",revision:snap.revision,currentIndex:0,answers})).status,200);
    snap=(await api(path,f.a.cookie)).data; assert.deepEqual(snap.draftAnswers,answers); assert.deepEqual(snap.question.steps[0].options.map((o:any)=>o.id),order);
    assert.equal((await api(path,f.b.cookie)).status,404);
    assert.equal((await api(`${path}/state`,f.b.cookie,"PATCH",{action:"save",revision:snap.revision,currentIndex:0,answers})).status,404);
    assert.equal((await api("/api/attempts",f.b.cookie,"POST",submission(s.id,f.q(0),`${f.q(0)}-0`))).status,404);
    for(const answer of ["A","7","foreign-id"]) assert.equal((await api("/api/attempts",f.a.cookie,"POST",submission(s.id,f.q(0),answer))).status,400);
    const payload=submission(s.id,f.q(0),`${f.q(0)}-1`);
    const replies=await Promise.all([api("/api/attempts",f.a.cookie,"POST",payload),api("/api/attempts",f.a.cookie,"POST",payload)]);
    assert.deepEqual(replies[0].data,replies[1].data); assert.equal(replies[0].status,200);
    assert.equal(replies[0].data.score,0); assert.equal(replies[0].data.isPartial,false);
    assert.equal(await prisma.userAttempt.count({where:{sessionId:s.id}}),1);
    assert.equal((await api("/api/attempts",f.a.cookie,"POST",{...payload,stepAnswers:[{stepId:sid,answer:`${f.q(0)}-0`}]})).status,409);
    assert.equal((await api("/api/attempts",f.a.cookie,"POST",submission(s.id,f.q(0),`${f.q(0)}-0`))).status,409);
    snap=(await api(path,f.a.cookie)).data; assert.deepEqual(snap.result.choice.selectedOptionIds,[`${f.q(0)}-1`]); assert.ok(snap.result.explanation);
    assert.equal((await api(`${path}/state`,f.a.cookie,"PATCH",{action:"save",revision:snap.revision,currentIndex:0,answers})).status,409);
    assert.equal((await api(`${path}/state`,f.a.cookie,"PATCH",{action:"retry",revision:snap.revision})).status,200);
    snap=(await api(path,f.a.cookie)).data; assert.equal(snap.result,null); assert.deepEqual(snap.draftAnswers,{}); noKeys(snap.question);
    const hint = await api(`${path}/hint`,f.a.cookie,"POST",{questionId:f.q(0)}); assert.equal(hint.status,200); assert.ok(hint.data.hints[sid]);
    const retry=await api("/api/attempts",f.a.cookie,"POST",submission(s.id,f.q(0),`${f.q(0)}-0`));
    assert.equal(retry.status,200); assert.equal(retry.data.usedHint,true); assert.equal(retry.data.attemptNumber,2);
    assert.equal(retry.data.sessionStats.completedCount,1); assert.equal(retry.data.sessionStats.correctCount,1);
    const observations=await prisma.skillObservation.findMany({where:{userId:f.a.id,questionId:f.q(0)},orderBy:{createdAt:"asc"}});
    assert.equal(observations.length,2); assert.ok(observations[1].usedHint);
    const topicProgress=await prisma.userTopicProgress.findUniqueOrThrow({where:{userId_topicId:{userId:f.a.id,topicId:f.topic.id}}});
    assert.equal(topicProgress.masteryScore,calculateMasteryScore([{isCorrect:false,isPartial:false,score:0,usedHint:false,difficulty:1,attemptNumber:1},{isCorrect:true,isPartial:false,score:100,usedHint:true,difficulty:1,attemptNumber:2}],0));
    assert.equal(await prisma.userAttempt.count({where:{userId:f.b.id}}),0);
    snap=(await api(path,f.a.cookie)).data; assert.equal((await api(`${path}/state`,f.a.cookie,"PATCH",{action:"next",revision:snap.revision})).status,200);
    snap=(await api(path,f.a.cookie)).data; assert.equal(snap.currentIndex,1); assert.equal(snap.question.id,f.q(1));
    const plainWrong=await api("/api/attempts",f.a.cookie,"POST",submission(s.id,f.q(1),`${f.q(1)}-2`)); assert.equal(plainWrong.data.errorType,"unclassified");
    const marked=await prisma.mistake.findFirstOrThrow({where:{attemptId:replies[0].data.attemptId}}); assert.equal(marked.skillId,f.skill.id);
    const unmarked=await prisma.mistake.findFirstOrThrow({where:{attemptId:plainWrong.data.attemptId}}); assert.equal(unmarked.skillId,null);
    const multi=await f.session(f.b.id,[f.q(21),...Array.from({length:19},(_,i)=>f.q(i))]), mpath=`/api/sessions/${multi.id}`;
    let ms=(await api(mpath,f.b.cookie)).data; assert.equal(ms.question.steps[0].type,"multiple_select");
    assert.equal(ms.question.steps[0].prompt,"Выберите все правильные ответы"); noKeys(ms.question);
    const ma={[choiceStepId(f.q(21))]:JSON.stringify([`${f.q(21)}-1`])};
    await api(`${mpath}/state`,f.b.cookie,"PATCH",{action:"save",revision:ms.revision,currentIndex:0,answers:ma});
    assert.deepEqual((await api(mpath,f.b.cookie)).data.draftAnswers,ma);
    const partial=await api("/api/attempts",f.b.cookie,"POST",submission(multi.id,f.q(21),ma[choiceStepId(f.q(21))])); assert.equal(partial.data.score,0);assert.equal(partial.data.isPartial,false);
    ms=(await api(mpath,f.b.cookie)).data; await api(`${mpath}/state`,f.b.cookie,"PATCH",{action:"retry",revision:ms.revision});
    const both=await api("/api/attempts",f.b.cookie,"POST",submission(multi.id,f.q(21),JSON.stringify([`${f.q(21)}-1`,`${f.q(21)}-0`]))); assert.equal(both.data.score,100);
    // An old saved result keeps its numeric answer; retry switches to final-answer choices.
    const old=await prisma.practiceSession.create({data:{userId:f.a.id,mode:"mixed",totalCount:1,questionIds:[f.q(2)],draftAnswers:{old:"free text"}}});
    const legacyStep=await prisma.questionStep.findFirstOrThrow({where:{questionId:f.q(2)}});
    const attempt=await prisma.userAttempt.create({data:{userId:f.a.id,sessionId:old.id,questionId:f.q(2),isCorrect:true,score:100,
      stepAnswers:{create:{stepId:legacyStep.id,answer:"7",isCorrect:true}}}});
    await prisma.practiceSession.update({where:{id:old.id},data:{currentAttemptId:attempt.id}});
    const oldResult=(await api(`/api/sessions/${old.id}`,f.a.cookie)).data; assert.equal(oldResult.result.stepResults[0].userAnswer,"7"); assert.equal(oldResult.result.score,100);
    const checks=await prisma.$transaction(async tx=>{await lockAccount(tx,f.b.id); return startLearningCheck(tx,f.b.id,{skillId:f.skill.id,excluded:[f.q(21)]});});
    assert.ok(checks); const checked=await api("/api/attempts",f.b.cookie,"POST",submission(checks.sessionId,checks.questionId,`${checks.questionId}-0`)); assert.equal(checked.data.learningCheck.status,"passed");
    const download=await api("/api/offline/packages",f.a.cookie,"POST",{downloadId:randomUUID(),topicIds:[f.topic.id],language:"ru",count:1});
    assert.equal(download.status,200,JSON.stringify(download.data)); noKeys(download.data);
    const pack=download.data,q=pack.questions[0];assert.equal(q.steps.length,1);assert.equal(q.steps[0].options.length,5);
    const offline={...submission(pack.sessionId,q.id,`${q.id}-0`),userId:f.a.id,packageId:pack.id,contentVersion:pack.contentVersion,sequence:0,revision:0};
    const rawStep=await prisma.questionStep.findFirstOrThrow({where:{questionId:q.id}});
    assert.equal((await api("/api/offline/sync",f.a.cookie,"POST",{...offline,submissionId:randomUUID(),stepAnswers:[{stepId:rawStep.id,answer:"7"}]})).status,400,
      "A fresh package cannot bypass option-ID grading with a legacy payload");
    const receipts=await Promise.all([api("/api/offline/sync",f.a.cookie,"POST",offline),api("/api/offline/sync",f.a.cookie,"POST",offline)]);
    assert.equal(receipts[0].status,200,JSON.stringify(receipts[0].data)); assert.deepEqual(receipts[0].data,receipts[1].data);assert.equal(receipts[0].data.result.usedHint,true);
    // A package downloaded before the upgrade must keep its old wire contract and queued answer.
    const legacyPack=await prisma.$transaction(async tx=>{
      const content=await currentContent(tx,[f.topic.id],[f.q(3)],"ru");
      const session=await tx.practiceSession.create({data:{userId:f.a.id,mode:"offline_practice",totalCount:1,questionIds:[f.q(3)]}});
      return tx.offlinePackage.create({data:{id:randomUUID(),userId:f.a.id,sessionId:session.id,language:"ru",selectionHash:"legacy-fixture",
        contentVersion:content.version,content:content.content as unknown as Prisma.InputJsonValue}});
    });
    const oldOfflineStep=await prisma.questionStep.findFirstOrThrow({where:{questionId:f.q(3)}});
    await api(`/api/sessions/${legacyPack.sessionId}`,f.a.cookie);
    assert.equal((await api(`/api/offline/packages/${legacyPack.id}`,f.a.cookie)).data.currentVersion,legacyPack.contentVersion);
    const oldQueue={submissionId:randomUUID(),sessionId:legacyPack.sessionId,questionId:f.q(3),userId:f.a.id,packageId:legacyPack.id,
      contentVersion:legacyPack.contentVersion,sequence:0,revision:0,timeSpent:3,usedHint:true,stepAnswers:[{stepId:oldOfflineStep.id,answer:"7"}]};
    const oldSynced=await api("/api/offline/sync",f.a.cookie,"POST",oldQueue);assert.equal(oldSynced.status,200,JSON.stringify(oldSynced.data));assert.equal(oldSynced.data.result.score,100);
    assert.deepEqual((await api("/api/offline/sync",f.a.cookie,"POST",oldQueue)).data,oldSynced.data);
    // Finishing early cannot disclose solutions to unanswered questions.
    noKeys((await api(`/api/sessions/${short.data.id}`,f.a.cookie,"PATCH",{})).data);
    console.log("PASS: choice HTTP persistence, exact grading, concurrent replay, explicit retry, Mastery, unique counts, skill checks, legacy review, private offline sync, user isolation");
  } finally { await f.cleanup(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
