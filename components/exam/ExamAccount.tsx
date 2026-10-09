"use client";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/providers/AccountProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { navigateAfterAuth } from "@/lib/client-auth";

export function ExamAccount() {
  const { user } = useAccount(), { locale } = useLanguage(), kk = locale === "kk";
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      await navigateAfterAuth("/login");
    } catch { setError(kk ? "Шығу мүмкін болмады. Қайта көріңіз." : "Не удалось выйти. Повторите попытку."); setBusy(false); }
  }
  return <><Header title={kk ? "Аккаунт" : "Аккаунт"} /><div className="page-content reading-content">
    <section className="space-y-4 rounded-lg border p-4 sm:p-6"><p className="break-words font-medium">{user?.name}</p><p className="break-all text-muted-foreground">{user?.email}</p>
      <Button variant="outline" disabled={busy} onClick={logout}>{kk ? "Шығу" : "Выйти"}</Button>
      {error && <p role="alert">{error}</p>}
    </section>
  </div></>;
}
