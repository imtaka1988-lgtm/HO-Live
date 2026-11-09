import test from "node:test";
import assert from "node:assert/strict";
import { getSiteBasePathFromModuleUrl } from "../../haiou-live/assets/js/site-base-path.mjs";

test("root-domain deployments use no prefix even when the module URL is versioned", () => {
  assert.equal(getSiteBasePathFromModuleUrl("https://example.com/assets/js/config.js?v=1"), "");
});

test("GitHub Pages keeps both the repository and front-end directory", () => {
  const moduleUrl = "https://example.github.io/HO-Live/haiou-live/assets/js/config.js";
  assert.equal(getSiteBasePathFromModuleUrl(moduleUrl), "/HO-Live/haiou-live");
});

test("nested deployments keep the full prefix even when a folder is named pages", () => {
  const moduleUrl = "https://example.com/stage/pages/assets/js/config.js";
  assert.equal(getSiteBasePathFromModuleUrl(moduleUrl), "/stage/pages");
});
