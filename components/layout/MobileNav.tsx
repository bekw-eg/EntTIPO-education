"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useNavigation, isCurrentRoute } from "./useNavigation";
export function MobileNav() {
  const pathname = usePathname(), items = useNavigation();
  if (pathname === "/login") return null;
  return <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card md:hidden mobile-nav-safe">
    <nav aria-label="Synaq" className="grid h-16 grid-cols-3 px-1">
      {items.map(item => <Link key={item.href} href={item.href} aria-current={isCurrentRoute(pathname, item.href) ? "page" : undefined}
        className={cn("flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-center text-xs leading-tight", isCurrentRoute(pathname, item.href) ? "font-medium text-primary" : "text-muted-foreground")}>
        <item.icon aria-hidden="true" className="h-5 w-5" /><span>{item.name}</span>
      </Link>)}
    </nav>
  </div>;
}
