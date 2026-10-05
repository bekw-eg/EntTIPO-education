"use client";

import { createContext, useContext, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setActiveAccount, offlineLocked } from "@/lib/offline/store";

export interface AccountProfile {
  id: string;
  name: string;
  email: string;
  isDemo: boolean;
}

const AccountContext = createContext<{
  user: AccountProfile | null;
  demoEnabled: boolean;
}>({ user: null, demoEnabled: false });

export function useAccount() {
  return useContext(AccountContext);
}

export function AccountProvider({ user, demoEnabled, children }: {
  user: AccountProfile | null;
  demoEnabled: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const requiresLogin = !user && pathname !== "/login";

  useEffect(() => {
    if (requiresLogin) router.replace("/login");
  }, [requiresLogin, router]);

  useEffect(() => {
    let cancelled = false;
    // Server-provided authenticated profile; no credentials are persisted to IndexedDB.
    if (!user) { void setActiveAccount(null).catch(() => {}); return; }
    try { if (localStorage.getItem("enttipo_offline_locked")) return; } catch { return; }
    void offlineLocked().then(async locked => {
      if (locked || cancelled) return null;
      return fetch("/api/auth/me", { cache: "no-store" });
    }).then(async response => {
      if (!response) return;
      if (!response.ok) return;
      const me = await response.json();
      if (!cancelled && me.user?.id === user.id) await setActiveAccount({ userId: user.id, name: user.name });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, user?.name]);

  useEffect(() => {
    const handleAccountChange = (event: StorageEvent) => {
      if (event.key === "enttipo_auth_changed") window.location.reload();
    };
    window.addEventListener("storage", handleAccountChange);
    return () => window.removeEventListener("storage", handleAccountChange);
  }, []);

  return (
    <AccountContext.Provider value={{ user, demoEnabled }}>
      {requiresLogin ? null : children}
    </AccountContext.Provider>
  );
}
