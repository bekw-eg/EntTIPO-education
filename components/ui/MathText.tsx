"use client";
import { MathDisplay } from "./MathDisplay";
import { cn } from "@/lib/utils";
import { choiceLatex, choiceStem } from "@/lib/choiceDisplay";

/** Display formatting only: never writes back to an answer, choice or stored question. */
export function MathText({ content, className }: { content: string; className?: string }) {
  if (!content) return null;
  const latex = (value: string) => value.includes("\\") ? value : choiceLatex(value);
  return <div className={cn("math-copy", className)}>
    {content.split("\n").map((line, index) => {
      const raw = line.trim();
      // Legacy RU/KK lessons embed expressions in prose without dollar delimiters.
      const text = !raw.includes("$") && /\p{Script=Cyrillic}/u.test(raw) &&
        /[=^_]|[\da-z)]\s*[+*·/]\s*[\da-z(]|\b(?:sqrt|sin|cos|tan|log)\(/.test(raw) ? choiceStem(raw) : raw;
      if (!text) return null;
      if (text.includes("$")) return <div key={index}>
        {text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$)/g).map((part, i) => {
          if (part.startsWith("$$") && part.endsWith("$$")) return <span key={i} className="math-block"><MathDisplay math={latex(part.slice(2,-2))} block /></span>;
          if (part.startsWith("$") && part.endsWith("$")) return <span key={i} className="math-inline"><MathDisplay math={latex(part.slice(1,-1))} /></span>;
          return <span key={i}>{part}</span>;
        })}
      </div>;
      const prose = /[а-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ]/.test(text) || /\b[A-Za-z]{4,}\b/.test(text.replace(/\\[A-Za-z]+|sqrt|sin|cos|tan|log|exp|abs/g, ""));
      if (!prose && /[\d=+^_*\\<>√π]|\b[xyzabc]\b/.test(text)) return <div key={index} className="math-block"><MathDisplay math={latex(text)} /></div>;
      return <div key={index}>{text}</div>;
    })}
  </div>;
}
