/** Retired public surfaces. Data and internal learning code remain available. */
export const retiredPages = ["/learning-road","/diagnostics","/practice","/topics","/learn","/mistakes","/statistics","/geometry","/offline-practice.html","/offline.html","/offline-assets","/manifest.json"];

export function isRetiredPage(href: string) {
  const path = href.split(/[?#]/)[0];
  return retiredPages.some(root => path === root || path.startsWith(root + "/"));
}
