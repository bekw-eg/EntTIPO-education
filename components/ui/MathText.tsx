"use client";

import React from "react";
import { MathDisplay } from "./MathDisplay";
import { cn } from "@/lib/utils";

interface MathTextProps {
  content: string;
  className?: string;
}

export function MathText({ content, className }: MathTextProps) {
  if (!content) return null;

  const lines = content.split("\n");

  return (
    <div className={cn("space-y-2 font-sans", className)}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        // 1. Line contains inline LaTeX math enclosed in $...$
        if (trimmed.includes("$")) {
          const parts = trimmed.split(/(\$[^$]+\$)/g);
          return (
            <div key={idx} className="text-sm sm:text-base leading-relaxed py-0.5 text-foreground/90">
              {parts.map((part, pIdx) => {
                if (part.startsWith("$") && part.endsWith("$") && part.length >= 2) {
                  const math = part.slice(1, -1);
                  return (
                    <span key={pIdx} className="inline-block mx-1">
                      <MathDisplay math={math} block={false} />
                    </span>
                  );
                }
                return <span key={pIdx}>{part}</span>;
              })}
            </div>
          );
        }

        // 2. Check if line has natural language words (Cyrillic or leading English words like "For", "Domain")
        const hasNaturalLanguage =
          /[а-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ]/.test(trimmed) ||
          /^(For|Domain|Vertical|Horizontal|Step)\b/i.test(trimmed);

        if (!hasNaturalLanguage) {
          // Pure math formula line (e.g. "2^3 = 8", "\sqrt{9} = 3", "27^{2/3} = ...")
          return (
            <div
              key={idx}
              className="py-2.5 px-4 bg-background/90 dark:bg-muted/40 rounded-xl border border-border/60 overflow-x-auto my-1.5 shadow-2xs"
            >
              <MathDisplay math={trimmed} block={false} className="text-base sm:text-lg" />
            </div>
          );
        }

        // 3. Mixed line or descriptive commentary line
        return (
          <div key={idx} className="text-sm sm:text-base leading-relaxed text-foreground/90 font-medium">
            {trimmed}
          </div>
        );
      })}
    </div>
  );
}
