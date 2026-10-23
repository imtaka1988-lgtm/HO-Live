import test from "node:test";
import assert from "node:assert/strict";
import { getSiteBasePathFromPath } from "../../haiou-live/assets/js/site-base-path.mjs";

test("root-domain pages do not become a fake deployment prefix", () => {
  assert.equal(getSiteBasePathFromPath("/"), "");
  assert.equal(getSiteBasePathFromPath("/index.html"), "");
  assert.equal(getSiteBasePathFromPath("/pages/live.html"), "");
  assert.equal(getSiteBasePathFromPath("/pages/room.html"), "");
  assert.equal(getSiteBasePathFromPath("/assets/js/main.js"), "");
  assert.equal(getSiteBasePathFromPath("/api/public/rooms"), "");
  assert.equal(getSiteBasePathFromPath("/admin/index.html"), "");
});

test("GitHub Pages project-subpath hosting keeps the repository prefix", () => {
  assert.equal(getSiteBasePathFromPath("/HO-Live/"), "/HO-Live");
  assert.equal(getSiteBasePathFromPath("/HO-Live/index.html"), "/HO-Live");
  assert.equal(getSiteBasePathFromPath("/HO-Live/pages/live.html"), "/HO-Live");
  assert.equal(getSiteBasePathFromPath("/HO-Live/pages/room.html"), "/HO-Live");
  assert.equal(getSiteBasePathFromPath("/HO-Live/assets/js/main.js"), "/HO-Live");
});

test("custom subdirectory deployments keep their first path segment", () => {
  assert.equal(getSiteBasePathFromPath("/stage/pages/live.html"), "/stage");
  assert.equal(getSiteBasePathFromPath("/preview/index.html"), "/preview");
});

test("query strings and fragments do not affect the detected prefix", () => {
  assert.equal(getSiteBasePathFromPath("/pages/live.html?tab=all"), "");
  assert.equal(getSiteBasePathFromPath("/HO-Live/pages/room.html#player"), "/HO-Live");
});

test("empty and relative input safely resolve to no prefix", () => {
  assert.equal(getSiteBasePathFromPath(""), "");
  assert.equal(getSiteBasePathFromPath("pages/live.html"), "");
  assert.equal(getSiteBasePathFromPath(null), "");
});
