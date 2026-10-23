/**
 * Resolve the deployment prefix for root-domain and project-subpath hosting.
 *
 * Examples:
 *   /pages/live.html       -> ""
 *   /index.html            -> ""
 *   /HO-Live/pages/live.html -> "/HO-Live"
 *
 * This module is deliberately pure so the path rules can be regression-tested
 * without a browser.
 */
const ROOT_PATH_SEGMENTS = new Set([
  "admin",
  "anchor",
  "api",
  "assets",
  "auth",
  "css",
  "data",
  "fonts",
  "images",
  "img",
  "js",
  "pages",
  "replays",
  "static",
  "uploads",
  "user",
  "vendor"
]);

export function getSiteBasePathFromPath(pathname) {
  const path = String(pathname || "/").split(/[?#]/, 1)[0] || "/";
  if (!path.startsWith("/")) return "";

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return "";

  const firstSegment = segments[0];
  const firstLower = firstSegment.toLowerCase();

  // A normal root-level page such as /index.html is not a deployment prefix.
  if (/\.[a-z0-9]+$/i.test(firstSegment)) return "";

  // These are application paths when the site is deployed at the domain root.
  if (ROOT_PATH_SEGMENTS.has(firstLower)) return "";

  // Unknown first segments represent project/subdirectory hosting, e.g. /HO-Live/.
  return "/" + firstSegment;
}
