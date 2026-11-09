// config.js lives under assets/js/ in every deployment.
export function getSiteBasePathFromModuleUrl(moduleUrl) {
  return new URL("../../", moduleUrl).pathname.slice(0, -1);
}
