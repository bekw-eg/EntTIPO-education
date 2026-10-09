import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import records from '../lib/exam/verified-bank.json';
import { VERIFIED_EXERCISES, hasVerifiedContent } from '../lib/exam/generated-bank';
import { choiceLatex, choiceStem } from '../lib/choiceDisplay';
import katex from 'katex';

assert.ok(VERIFIED_EXERCISES.length >= 2000, 'Only admitted, digest-bound mathematical tasks count');
assert.equal(new Set(VERIFIED_EXERCISES.map(q=>q.mathKey)).size, VERIFIED_EXERCISES.length);
assert.ok(new Set(VERIFIED_EXERCISES.map(q=>q.family)).size >= 50);
const first=records.find(hasVerifiedContent)!;
for(const q of VERIFIED_EXERCISES) {
  for(const option of q.options) katex.renderToString(choiceLatex(option),{throwOnError:true});
  for(const text of [q.text,q.textKk,q.explanation,q.explanationKk])
    for(const match of choiceStem(text).matchAll(/\$([^$]+)\$/g)) katex.renderToString(match[1],{throwOnError:true});
}
console.log(`PASS: KaTeX rendering of all ${VERIFIED_EXERCISES.length} admitted bilingual tasks, solutions and options`);
if(process.argv.includes('--render-only')) process.exit(0);
for(const patch of [{text:'Incorrect replacement'}, {textKk:'Қате аударма'}, {band:'C'}, {options:[...first.options].reverse()}, {mathKey:'forged'}]) {
  assert.equal(hasVerifiedContent({...first,...patch}),false,'Changed content must be quarantined');
}
const verifier = readFileSync('scripts/verify_generated_exam_math.py','utf8');
const python = process.env.EXAM_MATH_PYTHON;
const run = spawnSync(python??'docker', python?['-X','utf8','-c',verifier]:['exec','-i','entTIPO_math','python','-c',verifier], {
  input:JSON.stringify(records),encoding:'utf8',timeout:900000,maxBuffer:4*1024*1024,
});
if(run.stdout) process.stdout.write(run.stdout);
if(run.stderr) process.stderr.write(run.stderr);
if(run.error) console.error(run.error);
assert.equal(run.status,0,'Independent verification of every frozen generated question');
