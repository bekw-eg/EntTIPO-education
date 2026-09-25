"use client";
import { useEffect, useRef } from "react";
import katex from "katex";
import { cn } from "@/lib/utils";

interface MathDisplayProps {
  math: string;
  block?: boolean;
  className?: string;
}

export function MathDisplay({ math, block = false, className }: MathDisplayProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(math, ref.current, {
        throwOnError: false,
        displayMode: block,
        output: "html",
      });
    } catch {
      if (ref.current) ref.current.textContent = math;
    }
  }, [math, block]);

  return <span ref={ref} className={cn(block ? "block overflow-x-auto py-2" : "inline", className)} />;
}
