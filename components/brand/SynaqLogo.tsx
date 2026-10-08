import Image from "next/image";
import { cn } from "@/lib/utils";

export function SynaqMark({ className, decorative = false }: { className?: string; decorative?: boolean }) {
  return <Image src="/brand/synaq-mark.svg" width={408} height={378} unoptimized
    alt={decorative ? "" : "Synaq"} aria-hidden={decorative || undefined}
    className={cn("h-auto w-8 shrink-0", className)} />;
}

export function SynaqLogo({ className, markClassName, wordmarkClassName, subtitle }: {
  className?: string; markClassName?: string; wordmarkClassName?: string; subtitle?: string;
}) {
  return <span className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
    <SynaqMark decorative className={markClassName} />
    <span className="flex flex-col">
      <span className={cn("text-xl font-bold leading-none tracking-[-0.055em]", wordmarkClassName)}>Synaq</span>
      {subtitle && <span className="mt-1 text-xs font-normal tracking-normal text-muted-foreground">{subtitle}</span>}
    </span>
  </span>;
}
