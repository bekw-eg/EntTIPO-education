"use client";
import { MathText } from "@/components/ui/MathText";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { choiceLatex } from "@/lib/choiceDisplay";
export function ChoiceMath({ text }: { text: string }) {
  const unit = text.match(/^(.*?)\s+(см[²³]?)$/);
  if (unit) return <span><MathDisplay math={choiceLatex(unit[1])} /> {unit[2]}</span>;
  return /[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(text) || text.includes("$")
    ? <MathText content={text} /> : <MathDisplay math={choiceLatex(text)} />;
}
