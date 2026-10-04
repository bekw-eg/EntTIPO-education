"use client";

import React from "react";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { cn } from "@/lib/utils";

interface AiMessageRendererProps {
  content: string;
  className?: string;
}

/**
 * Parses text containing inline LaTeX (\(...\) or $...$) and renders with KaTeX.
 */
function renderInlineMath(text: string): React.ReactNode[] {
  // Normalize \( ... \) to $ ... $
  const normalized = text.replace(/\\\((.*?)\\\)/g, "$$$1$$");
  // Split on $...$
  const parts = normalized.split(/(\$[^$]+\$)/g);

  return parts.map((part, idx) => {
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      const math = part.slice(1, -1);
      return (
        <span key={idx} className="inline-block mx-1">
          <MathDisplay math={math} block={false} />
        </span>
      );
    }

    // Process bold text **...**
    if (part.includes("**")) {
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={idx}>
          {boldParts.map((bp, bIdx) => {
            if (bp.startsWith("**") && bp.endsWith("**")) {
              return (
                <strong key={bIdx} className="font-semibold text-foreground">
                  {bp.slice(2, -2)}
                </strong>
              );
            }
            return bp;
          })}
        </span>
      );
    }

    return <span key={idx}>{part}</span>;
  });
}

export function AiMessageRenderer({ content, className }: AiMessageRendererProps) {
  if (!content) return null;

  // Split content by block math \[...\] or $$...$$
  const blockRegex = /(?:\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$)/g;
  const segments: Array<{ type: "text" | "block_math"; content: string }> = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }
    const mathContent = match[1] || match[2] || "";
    segments.push({
      type: "block_math",
      content: mathContent.trim(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  return (
    <div className={cn("space-y-2.5 text-sm sm:text-base leading-relaxed text-foreground/90 font-sans", className)}>
      {segments.map((seg, sIdx) => {
        if (seg.type === "block_math") {
          return (
            <div
              key={sIdx}
              className="py-2.5 px-4 my-2 bg-muted/40 rounded-xl border border-border/70 text-center overflow-x-auto shadow-2xs"
            >
              <MathDisplay math={seg.content} block />
            </div>
          );
        }

        // Text segment: split by newlines
        const lines = seg.content.split("\n");
        return (
          <div key={sIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;

              // Check if bullet point
              if (/^[-*•]\s+/.test(trimmed)) {
                const bulletContent = trimmed.replace(/^[-*•]\s+/, "");
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1">{renderInlineMath(bulletContent)}</div>
                  </div>
                );
              }

              // Check if numbered list
              const numMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
              if (numMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="font-semibold text-primary text-xs mt-0.5 shrink-0 bg-primary/10 px-1.5 py-0.5 rounded">
                      {numMatch[1]}
                    </span>
                    <div className="flex-1">{renderInlineMath(numMatch[2])}</div>
                  </div>
                );
              }

              return <div key={lIdx}>{renderInlineMath(trimmed)}</div>;
            })}
          </div>
        );
      })}
    </div>
  );
}
