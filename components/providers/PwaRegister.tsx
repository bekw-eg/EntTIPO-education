"use client";
import { useEffect } from "react";
/** Replace older offline workers so archived practice cannot be served from cache. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(reg => reg.update()).catch(() => {});
    }
    const suppress = (event: Event) => event.preventDefault();
    window.addEventListener("beforeinstallprompt", suppress);
    return () => window.removeEventListener("beforeinstallprompt", suppress);
  }, []);
  return null;
}
