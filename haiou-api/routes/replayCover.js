const express = require("express");
const https = require("https");

const router = express.Router();
const MAX_IMAGE_BYTES = Number.parseInt(process.env.REPLAY_COVER_MAX_BYTES || "10485760", 10) || 10485760;
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.REPLAY_COVER_TIMEOUT_MS || "9000", 10) || 9000;
const agent = new https.Agent({ keepAlive: true, maxSockets: 10, timeout: REQUEST_TIMEOUT_MS });

function isAllowedCoverUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && /(^|\.)hdslb\.com$/i.test(url.hostname);
  } catch (_) {
    return false;
  }
}

function normalizeUrl(raw) {
  const value = String(raw || "").trim();
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value;
}

function targetFromRequest(req) {
  const requestedPath = String(req.query.path || "").trim();
  if (requestedPath) {
    if (!requestedPath.startsWith("/bfs/") || requestedPath.includes("..")) return "";
    return `https://i2.hdslb.com${requestedPath}`;
  }
  return normalizeUrl(req.query.url);
}

router.get("/", (req, res) => {
  const target = targetFromRequest(req);
  if (!isAllowedCoverUrl(target)) {
    return res.status(400).json({ ok: false, error: "封面地址不允许" });
  }

  const proxyRequest = https.get(target, {
    agent,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "User-Agent": "HO-Live/1.0",
      Referer: "https://www.bilibili.com/",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
    }
  }, proxyResponse => {
    if (proxyResponse.statusCode < 200 || proxyResponse.statusCode >= 300) {
      proxyResponse.resume();
      return res.status(502).json({ ok: false, error: "封面拉取失败" });
    }

    const contentType = String(proxyResponse.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      proxyResponse.resume();
      return res.status(502).json({ ok: false, error: "上游返回的不是图片" });
    }

    const declaredLength = Number.parseInt(proxyResponse.headers["content-length"] || "0", 10) || 0;
    if (declaredLength > MAX_IMAGE_BYTES) {
      proxyResponse.resume();
      return res.status(413).json({ ok: false, error: "封面图片过大" });
    }

    let transferred = 0;
    let aborted = false;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (declaredLength > 0) res.setHeader("Content-Length", String(declaredLength));

    proxyResponse.on("data", chunk => {
      transferred += chunk.length;
      if (transferred > MAX_IMAGE_BYTES && !aborted) {
        aborted = true;
        proxyResponse.destroy(new Error("replay cover too large"));
        if (!res.headersSent) res.status(413).json({ ok: false, error: "封面图片过大" });
        else res.destroy();
      }
    });
    proxyResponse.on("error", () => {
      if (!res.headersSent) res.status(502).json({ ok: false, error: "封面代理失败" });
      else res.destroy();
    });
    proxyResponse.pipe(res);
  });

  proxyRequest.on("timeout", () => proxyRequest.destroy(new Error("封面请求超时")));
  proxyRequest.on("error", () => {
    if (!res.headersSent) res.status(502).json({ ok: false, error: "封面代理失败" });
  });
  req.on("aborted", () => proxyRequest.destroy());
});

module.exports = router;
