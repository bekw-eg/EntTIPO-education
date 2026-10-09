"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { interfaceText } from "@/lib/i18n/interface";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useNavigation, isCurrentRoute } from "./useNavigation";
import { SynaqLogo } from "@/components/brand/SynaqLogo";

export function MobileNav() {
  const pathname = usePathname(), items = useNavigation();
  const { locale } = useLanguage(), copy = interfaceText[locale];
  const [open, setOpen] = useState(false);
  if (pathname === "/login") return null;
  return <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card md:hidden mobile-nav-safe">
    <nav aria-label={copy.navigation} className="grid h-16 grid-cols-5 px-1">
      {items.slice(0, 4).map(item => <Link key={item.href} href={item.href} aria-current={isCurrentRoute(pathname, item.href) ? "page" : undefined}
        className={cn("flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-center text-[11px] leading-tight", isCurrentRoute(pathname, item.href) ? "font-medium text-primary" : "text-muted-foreground")}>
        <item.icon aria-hidden="true" className="h-5 w-5" /><span>{item.name}</span>
      </Link>)}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><button type="button" className={cn("flex flex-col items-center justify-center gap-1 text-[11px]", items.slice(4).some(item => isCurrentRoute(pathname, item.href)) ? "text-primary" : "text-muted-foreground")}><Menu aria-hidden="true" className="h-5 w-5" />{copy.more}</button></DialogTrigger>
        <DialogContent closeLabel={copy.close}>
          <SynaqLogo className="pr-10" markClassName="w-9" />
          <DialogTitle className="pr-10">{copy.navigation}</DialogTitle><DialogDescription className="sr-only">Synaq</DialogDescription>
          <nav className="grid gap-1" aria-label={copy.more}>
            {items.slice(4).map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isCurrentRoute(pathname, item.href) ? "page" : undefined}
              className={cn("flex min-h-12 items-center gap-3 rounded-md px-3 text-sm hover:bg-muted", isCurrentRoute(pathname, item.href) && "bg-primary/10 text-primary")}>
              <item.icon aria-hidden="true" className="h-5 w-5 shrink-0" />{item.name}
            </Link>)}
          </nav>
        </DialogContent>
      </Dialog>
    </nav>
  </div>;
}
