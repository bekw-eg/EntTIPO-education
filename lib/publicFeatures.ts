/** Retired public surfaces. Data and internal learning code remain available. */
export const retiredPages = ["/learning-road","/diagnostics","/practice"];

export function isRetiredPage(href: string) {
  const path = href.split(/[?#]/)[0];
  return retiredPages.some(root => path === root || path.startsWith(root + "/"));
}
