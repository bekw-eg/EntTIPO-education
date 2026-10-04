"use client";

import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. Service Worker: only register in production.
    // On localhost or in development, proactively unregister any active SW and clear cache
    // to prevent CSS caching conflicts and HMR deadlocks.
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.endsWith(".local");

      if (process.env.NODE_ENV === "development" || isLocalhost) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
        if ("caches" in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              caches.delete(key);
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
      toast.success("Подключение к сети восстановлено");
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.warning("Нет подключения. Для загрузки личных данных восстановите сеть.", {
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
      toast.success("Приложение установлено на ваше устройство!");
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
            <span>Установить приложение</span>
          </Button>
        </div>
      )}
    </>
  );
}
