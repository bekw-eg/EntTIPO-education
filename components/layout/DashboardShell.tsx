"use client";

import { Children, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

/** Hydrate the navigation and its sibling landmark as one client boundary. */
export function DashboardShell({ children }: { children: ReactNode }) {
  // Resolve the streamed page slot before opening its host landmark. A pending
  // lazy slot must suspend this component, not complete an empty <main> during hydration.
  const content = Children.toArray(children);
  return <div className="flex min-h-screen">
    <Sidebar />
    <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 pb-24 md:pb-8">{content}</main>
    <MobileNav />
  </div>;
}
