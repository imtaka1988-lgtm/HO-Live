const express = require("express");
const https = require("https");
const http = require("http");

const router = express.Router();

function isAllowedCoverUrl(raw) {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return false;
    return /(^|\.)hdslb\.com$/i.test(u.hostname);
  } catch (e) {
    return false;
  }
}

function normalizeUrl(raw) {
  if (!raw) return "";
  if (raw.startsWith("//")) return "https:" + raw;
  if (raw.startsWith("http://")) return "https://" + raw.slice(7);
  return raw;
}

function targetFromRequest(req) {
  const path = String(req.query.path || "").trim();
  if (path) {
    if (!path.startsWith("/bfs/")) return "";
    if (path.includes("..")) return "";
    return "https://i2.hdslb.com" + path;
  }
  return normalizeUrl(String(req.query.url || ""));
}

router.get("/", (req, res) => {
  const target = targetFromRequest(req);
  if (!isAllowedCoverUrl(target)) {
    return res.status(400).json({ ok: false, error: "封面地址不允许" });
  }

  const client = target.startsWith("https://") ? https : http;
  const proxyReq = client.get(target, {
    timeout: 9000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Referer": "https://www.bilibili.com/",
      "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    }
  }, proxyRes => {
    if (proxyRes.statusCode < 200 || proxyRes.statusCode >= 300) {
      proxyRes.resume();
      return res.status(502).json({ ok: false, error: "封面拉取失败" });
    }

    const contentType = proxyRes.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    proxyRes.pipe(res);
  });

  proxyReq.on("timeout", () => proxyReq.destroy(new Error("封面请求超时")));
  proxyReq.on("error", () => {
    if (!res.headersSent) res.status(502).json({ ok: false, error: "封面代理失败" });
  });
});

module.exports = router;
