import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { EXAM_EXERCISES } from "../lib/exam/bank";
import { parseChoice } from "../lib/practiceChoice";
import { choiceLatex } from "../lib/choiceDisplay";
import katex from "katex";
const prisma = new PrismaClient();
async function main() {
  const bank = await prisma.question.findMany({where:{purpose:{in:["practice","verification"]}},include:{steps:true}});
  const ready=bank.filter(q=>q.practiceChoice);
  for(const q of bank.filter(q=>!q.practiceChoice)) console.log(JSON.stringify({id:q.id,text:q.questionText,latex:q.latex,answer:q.correctAnswer}));
  for(const q of ready) {
    const c=parseChoice(q.practiceChoice);
    for(const stem of [c.questionText,c.questionTextKk??""]) for(const match of stem.matchAll(/\$([^$]+)\$/g)) {
      katex.renderToString(match[1],{throwOnError:true});
    }
    if(c.latex && !c.latex.startsWith("[GEOMETRY:")) katex.renderToString(c.latex,{throwOnError:true});
    for(const o of c.options) if(!/[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(o.text)) katex.renderToString(choiceLatex(o.text),{throwOnError:true});
  }
  const python=process.env.CHOICE_AUDIT_PYTHON??"python";
  const env={...process.env,...(existsSync("tmp/choice-python-libs")?{PYTHONPATH:"tmp/choice-python-libs"}:{})};
  const run=spawnSync(python,["-X","utf8","scripts/verify_choice_math.py"],{input:JSON.stringify({bank:ready,exam:EXAM_EXERCISES}),encoding:"utf8",env,timeout:120000});
  process.stdout.write(run.stdout??"");process.stderr.write(run.stderr??"");
  if(run.error) throw run.error;
  if(run.status!==0) throw new Error("Mathematical choice audit failed");
  console.log(`PASS: ${ready.length} ready tasks; ${bank.length-ready.length} retained legacy tasks awaiting authored choices`);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
