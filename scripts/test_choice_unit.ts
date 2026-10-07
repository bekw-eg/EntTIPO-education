import assert from "node:assert/strict";
import { gradeChoice, selection, publicChoiceStep, multiAnswerLimit, capChoiceQuestions, choiceSchema } from "../lib/practiceChoice";
import { testChoice, noKeys, prisma } from "./choice_test_fixture";
import { choiceLatex, choiceStem } from "../lib/choiceDisplay";
import katex from "katex";

const single = testChoice("s"), multi = testChoice("m", true);
assert.equal(gradeChoice(single, "s-0").isCorrect, true);
assert.equal(gradeChoice(single, "s-4").isCorrect, false);
for (const bad of ["A", "7", "foreign", '["s-0"]', ""]) assert.throws(() => gradeChoice(single, bad));
assert.equal(gradeChoice(multi, '["m-1","m-0"]').isCorrect, true);
for (const values of [["m-0"], ["m-1"], ["m-0","m-1","m-4"], ["m-2","m-3"]]) assert.equal(gradeChoice(multi, JSON.stringify(values)).isCorrect, false);
for (const bad of ['["m-0","m-0"]', '["foreign"]', "[]", "m-0"]) assert.throws(() => gradeChoice(multi, bad));
assert.deepEqual(selection(multi, "[]", true), []);
noKeys(publicChoiceStep("s", single)); noKeys(publicChoiceStep("m", multi));
assert.equal(publicChoiceStep("m", multi).prompt, "Выберите все правильные ответы");
assert.equal(gradeChoice({ ...single, options: [...single.options].reverse() }, "s-0").isCorrect, true);
assert.equal(choiceSchema.safeParse({ ...single, options: [single.options[0], ...single.options.slice(0,4)] }).success, false);
assert.equal(choiceSchema.safeParse({ ...single, correctOptionIds: ["s-0","s-1"] }).success, false);
for (let n = 1; n <= 100; n++) {
  assert.ok(multiAnswerLimit(n) <= Math.floor(n*.05));
  if (n < 20) assert.equal(multiAnswerLimit(n), 0);
  const rows = Array.from({length: n+10}, (_,i) => ({ id: `${i}`, practiceChoice: i % 3 === 0 ? multi : single }));
  const picked = capChoiceQuestions(rows, n);
  assert.ok(picked.filter(q => q.practiceChoice.type === "multiple").length <= Math.floor(picked.length*.05));
  assert.ok(capChoiceQuestions(rows, n, 0).every(q => q.practiceChoice.type === "single"));
}
assert.throws(() => multiAnswerLimit(100, 6));
for (const singles of [0, 1, 19, 20, 35, 38, 39, 40, 70, 95]) for (const percent of [0,1,2.5,5]) {
  const rows = Array.from({length:100+singles},(_,i)=>({id:`sparse-${i}`,practiceChoice:i<100?multi:single}));
  const picked = capChoiceQuestions(rows,100,percent);
  assert.ok(picked.filter(q=>q.practiceChoice.type==="multiple").length <= Math.floor(picked.length*percent/100),
    `A reduced denominator must respect the configured ceiling (${singles} single questions, ${percent}%)`);
}
assert.equal(capChoiceQuestions(Array.from({length:20}, (_,i) => ({ id:`${i}`, practiceChoice:single })),20).length,20);
for (const formula of ["sqrt(3)/2", "x^12", "ln(abs(x))+C", "3*x^2", "exp(2*x)+C", "{0; pi; 2*pi}", "√((−7)²)", "exp((x+1)^2)", "sqrt(1+sqrt(2))"]) {
  assert.ok(!katex.renderToString(choiceLatex(formula), { throwOnError: true }).includes("katex-error"));
}
for (const stem of ["Упрости −(x^2 · x^3 + 4)","Найдите f′(4), если f(x)=x^(3/2) при x>0.","√((−7)²) неге тең?", "Решите sin(x)>1/2 на [0; 2π].", "S_бок=πrl. 3πl=30π, значит l=10 см.", "Площадь основания S_{осн} = a^2."]) {
  const formatted=choiceStem(stem);assert.ok(formatted.includes("$"));
  for(const match of formatted.matchAll(/\$([^$]+)\$/g)) katex.renderToString(match[1],{throwOnError:true});
}
assert.ok(choiceStem("Площадь основания S_осн = a^2.").startsWith("Площадь основания "));
assert.ok(choiceStem("S_бок=πrl.").includes("S_{\\text{бок}}"));
console.log("PASS: single/multiple exact selection, opaque IDs, whitelist, reorder, rare ceiling without a quota, mathematical rendering");
void prisma.$disconnect();
