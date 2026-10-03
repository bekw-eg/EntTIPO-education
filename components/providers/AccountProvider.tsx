"use client";

import { createContext, useContext, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

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
