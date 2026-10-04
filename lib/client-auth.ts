/** Clear legacy shared storage, then discard the router's previous account state. */
export async function navigateAfterAuth(path: string): Promise<void> {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("enttipo_ai_dialog_")) localStorage.removeItem(key);
    }
  } catch {
    // Local storage can be disabled independently of Cache Storage.
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("ent-tipo-") && !key.startsWith("ent-tipo-static-"))
        .map((key) => caches.delete(key)));
    }
  } catch {
    // Storage can be disabled; full navigation still clears React/router state.
  }
  try {
    localStorage.setItem("enttipo_auth_changed", `${Date.now()}:${Math.random()}`);
  } catch {
    // Other tabs can only be notified when local storage is available.
  }
  window.location.assign(path);
}
