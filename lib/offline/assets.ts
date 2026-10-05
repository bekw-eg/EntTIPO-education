export interface AssetManifest { version: string; files: { url: string; sha256: string; bytes: number }[] }
export const OFFLINE_CACHE = "ent-tipo-static-offline-v1";
export async function digest(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function cacheAssets(manifest: AssetManifest, progress?: (done: number, total: number) => void) {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) throw new Error("Offline practice requires HTTPS or localhost");
  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const cache = await caches.open(OFFLINE_CACHE);
  let done = 0;
  for (const file of manifest.files) {
    if (!(file.url === "/offline-practice.html" || /^\/offline-assets\/[a-zA-Z0-9_./-]+$/.test(file.url)) || file.url.includes("..")) throw new Error("Invalid public asset manifest");
    const response = await fetch(file.url, { cache: "no-store" });
    if (!response.ok) throw new Error("Static resource download incomplete");
    const bytes = await response.clone().arrayBuffer();
    if (bytes.byteLength !== file.bytes || await digest(bytes) !== file.sha256) throw new Error("Static resource version changed; retry download");
    await cache.put(file.url, response);
    progress?.(++done, manifest.files.length);
  }
  const shell = manifest.files.find(file => /^\/offline-assets\/shell-.*\.html$/.test(file.url));
  if (!shell) throw new Error("Offline shell missing");
  const response = await cache.match(shell.url);
  if (!response) throw new Error("Offline shell incomplete");
  await cache.put("/offline-practice.html", response);
  if (!await assetsReady(manifest)) throw new Error("Static resources were evicted; free device storage and retry");
  try { await navigator.storage?.persist(); } catch { /* Browser can deny persistence. */ }
}
export async function assetsReady(manifest: AssetManifest): Promise<boolean> {
  const cache = await caches.open(OFFLINE_CACHE);
  for (const file of manifest.files) {
    const response = await cache.match(file.url);
    if (!response) return false;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== file.bytes || await digest(bytes) !== file.sha256) return false;
  }
  return true;
}
