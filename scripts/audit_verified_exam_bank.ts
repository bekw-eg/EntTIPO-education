import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { readExamAvailability } from '../lib/exam/session';
import { readCoverage } from '../lib/exam/database';
import { assessExamReadiness } from '../lib/exam/readiness';
import { TIPO_MATH } from '../lib/exam/profile';
import records from '../lib/exam/verified-bank.json';
import { nonRepeatingCapacity } from '../lib/exam/capacity';

const prisma = new PrismaClient();
async function main() {
  const languages = [];
  for (const language of ['ru','kk'] as const) {
    const coverage = await readCoverage(prisma,TIPO_MATH,language);
    const started = performance.now();
    const { candidates } = await prisma.$transaction(tx => readExamAvailability(tx,TIPO_MATH,language),{ timeout:30000 });
    const availabilityMs = Math.round(performance.now()-started);
    // A row counts only if a full valid paper can actually include its
    // point/band class. Families are confined to one point by the main audit.
    const reachableClasses = new Set<string>();
    for(const candidate of candidates) {
      const key=`${candidate.pointCode}/${candidate.band}`;
      if(reachableClasses.has(key)) continue;
      const pinned=candidates.filter(q=>q.pointCode!==candidate.pointCode||q.id===candidate.id);
      if(!assessExamReadiness(TIPO_MATH,pinned,1,true).canGenerate) throw new Error(`Unreachable exam candidate: ${candidate.id}`);
      reachableClasses.add(key);
    }
    let remaining = candidates, simulatedPapers = 0;
    for (;;) {
      const plan = assessExamReadiness(TIPO_MATH, remaining,1,true);
      if (!plan.canGenerate) break;
      const used = new Set(plan.selectedQuestionIds.map(id => remaining.find(q => q.id===id)!.mathKey));
      remaining = remaining.filter(q => !used.has(q.mathKey));
      simulatedPapers++;
    }
    languages.push({language, ...coverage.totals, serverUniqueEligible:new Set(candidates.map(q=>q.mathKey)).size,
      excludedCrossVersionDuplicates:coverage.totals.eligible-candidates.length,
      serverGeneratedEligible:candidates.filter(q=>q.id.startsWith('exam_v2_')).length,
      families:new Set(candidates.map(q=>q.family)).size, reachablePointBandClasses:reachableClasses.size, simulatedPapers, availabilityMs,
      uniqueDatabaseContent: new Set(coverage.questions.map(q=>q.contentHash)).size,
      uniqueDatabaseMathematics: new Set(coverage.questions.map(q=>q.mathKey)).size,
      ...nonRepeatingCapacity(TIPO_MATH,candidates),
      points:coverage.points.map(p=>{
        const available=candidates.filter(q=>q.pointCode===p.code);
        return {code:p.code,title:p.title,eligible:available.length,families:new Set(available.map(q=>q.family)).size,
          difficulty:Object.fromEntries(['A','B','C'].map(band=>[band,available.filter(q=>q.band===band).length]))};
      }),
      familyCatalog:[...new Set(candidates.map(q=>q.family))].sort().map(family=>{
        const rows=candidates.filter(q=>q.family===family);
        return {family,pointCode:rows[0].pointCode,band:rows[0].band,eligible:rows.length};
      })});
  }
  const report={checkedAt:'2026-10-10',generatedCandidates:records.length,passed:records.filter(q=>q.verification.result==='passed').length,
    excludedDuplicates:records.filter(q=>q.verification.result==='duplicate').length,
    supportingNotAdmitted:records.filter(q=>q.verification.result==='supporting').length,
    generatorFamilies:new Set(records.map(q=>q.family)).size,languages};
  const output=process.argv[2]??'docs/exam-bank-after.json';
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
