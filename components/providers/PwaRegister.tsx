"use client";
import { uiText, errorText } from "@/lib/i18n/messages";
import { useLanguage } from "@/lib/i18n/LanguageContext";


import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PwaRegister() {
  const { locale } = useLanguage();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Production (including localhost) supports offline practice.
    // Development disables the worker for HMR, retaining explicitly downloaded public assets.
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development") {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
        if ("caches" in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              if (key.startsWith("ent-tipo-") && key !== "ent-tipo-static-offline-v1") caches.delete(key);
            }
          });
        }
      } else {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("PWA Service Worker registered with scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("Service Worker registration failed:", err);
          });
      }
    }

    // 2. Listen to beforeinstallprompt event for PWA installation
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 3. Online / Offline status monitoring
    const handleOnline = () => {
      setIsOffline(false);
      toast.success(uiText("Подключение к сети восстановлено", locale));
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.warning(uiText("Нет подключения. Для загрузки личных данных восстановите сеть.", locale), {
        icon: <WifiOff className="w-4 h-4 text-amber-500" />,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!navigator.onLine) {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
      toast.success(uiText("Приложение установлено на ваше устройство!", locale));
    }
    setInstallPrompt(null);
  };

  return (
    <>
      {/* Floating PWA Install button when installable */}
      {isInstallable && (
        <div className="fixed bottom-20 right-4 z-50 md:bottom-6 animate-in fade-in slide-in-from-bottom-4">
          <Button
            onClick={handleInstallClick}
            className="shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-2 text-xs flex items-center gap-2 border border-primary/20"
          >
            <Download className="w-4 h-4" />
            <span>{uiText("Установить приложение", locale)}</span>
          </Button>
        </div>
      )}
    </>
  );
}
