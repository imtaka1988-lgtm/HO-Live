const express = require("express");
const https = require("https");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.REPLAY_META_TIMEOUT_MS || "9000", 10) || 9000;
const MAX_RESPONSE_BYTES = Number.parseInt(process.env.REPLAY_META_MAX_BYTES || "2097152", 10) || 2097152;
const CACHE_TTL_MS = Number.parseInt(process.env.REPLAY_META_CACHE_TTL_MS || "3600000", 10) || 3600000;
const CACHE_MAX_ENTRIES = Math.max(20, Number.parseInt(process.env.REPLAY_META_CACHE_MAX_ENTRIES || "200", 10) || 200);
const MAX_REDIRECTS = 3;
const ALLOWED_HOSTS = new Set(["api.bilibili.com", "www.bilibili.com", "bilibili.com"]);
const agent = new https.Agent({ keepAlive: true, maxSockets: 8, timeout: REQUEST_TIMEOUT_MS });
const cache = new Map();
const inFlight = new Map();

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = raw.startsWith("//") ? `https:${raw}` : raw.replace(/^http:\/\//i, "https://");
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch (_) {
    return "";
  }
}

function extractBvid(value) {
  const match = String(value || "").match(/BV[0-9A-Za-z]{10,20}/);
  return match ? match[0] : "";
}

function getAttr(tag, attrName) {
  const regex = new RegExp(`${attrName}\\s*=\\s*([\"'])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1`, "i");
  const match = String(tag || "").match(regex);
  return match && match[2] ? decodeHtml(match[2]) : "";
}

function extractMeta(html, key) {
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  const wanted = String(key || "").toLowerCase();
  for (const tag of tags) {
    const property = (getAttr(tag, "property") || getAttr(tag, "name")).toLowerCase();
    if (property !== wanted) continue;
    const content = getAttr(tag, "content");
    if (content) return content;
  }
  return "";
}

function extractTitle(html) {
  const openGraph = extractMeta(html, "og:title");
  if (openGraph) return openGraph.replace(/_哔哩哔哩_bilibili$/i, "").trim();
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match && match[1]
    ? decodeHtml(match[1]).replace(/_哔哩哔哩_bilibili$/i, "").trim()
    : "";
}

function isAllowedUrl(input) {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

function fetchText(inputUrl, options = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (!isAllowedUrl(inputUrl)) {
      reject(new Error("B站地址不允许"));
      return;
    }

    const request = https.get(inputUrl, {
      agent,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "User-Agent": "HO-Live/1.0",
        Accept: options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "identity",
        Referer: "https://www.bilibili.com/"
      }
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirects >= MAX_REDIRECTS) {
          reject(new Error("B站重定向次数过多"));
          return;
        }
        const nextUrl = new URL(response.headers.location, inputUrl).toString();
        resolve(fetchText(nextUrl, options, redirects + 1));
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`B站响应异常：${response.statusCode}`));
        return;
      }

      const declaredLength = Number.parseInt(response.headers["content-length"] || "0", 10) || 0;
      if (declaredLength > MAX_RESPONSE_BYTES) {
        response.resume();
        reject(new Error("B站响应过大"));
        return;
      }

      let body = "";
      let size = 0;
      response.setEncoding("utf8");
      response.on("data", chunk => {
        size += Buffer.byteLength(chunk);
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error("B站响应过大"));
          return;
        }
        body += chunk;
      });
      response.on("end", () => resolve(body));
    });
    request.on("timeout", () => request.destroy(new Error("B站请求超时")));
    request.on("error", reject);
  });
}

async function fetchBilibiliApi(bvid) {
  const raw = await fetchText(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
    { accept: "application/json,text/plain,*/*" }
  );
  const json = JSON.parse(raw);
  if (!json || json.code !== 0 || !json.data) {
    throw new Error(json && json.message ? json.message : "B站接口未返回视频信息");
  }
  return json.data;
}

async function fetchBilibiliPageMeta(bvid) {
  const html = await fetchText(`https://www.bilibili.com/video/${bvid}/`);
  return {
    title: extractTitle(html),
    cover: normalizeUrl(extractMeta(html, "og:image")),
    desc: extractMeta(html, "og:description") || extractMeta(html, "description"),
    cid: "",
    owner: ""
  };
}

function buildEmbedUrl(bvid, cid) {
  const url = new URL("https://player.bilibili.com/player.html");
  url.searchParams.set("isOutside", "true");
  url.searchParams.set("bvid", bvid);
  if (cid) url.searchParams.set("cid", String(cid));
  url.searchParams.set("p", "1");
  url.searchParams.set("autoplay", "0");
  url.searchParams.set("danmaku", "0");
  return url.toString();
}

function getCached(bvid) {
  const entry = cache.get(bvid);
  if (!entry || Date.now() - entry.ts >= CACHE_TTL_MS) return null;
  cache.delete(bvid);
  cache.set(bvid, entry);
  return entry.data;
}

function setCached(bvid, data) {
  if (cache.has(bvid)) cache.delete(bvid);
  cache.set(bvid, { ts: Date.now(), data });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function loadMetadata(bvid) {
  let meta;
  try {
    const data = await fetchBilibiliApi(bvid);
    meta = {
      title: String(data.title || "").slice(0, 300),
      cover: normalizeUrl(data.pic || ""),
      desc: String(data.desc || "").slice(0, 1000),
      cid: data.cid || "",
      owner: data.owner && data.owner.name ? String(data.owner.name).slice(0, 100) : ""
    };
  } catch (apiError) {
    meta = await fetchBilibiliPageMeta(bvid);
    console.warn(`[replay meta] API fallback for ${bvid}:`, apiError.message);
  }

  return {
    platform: "bilibili",
    bvid,
    pageUrl: `https://www.bilibili.com/video/${bvid}/`,
    title: meta.title,
    cover: meta.cover,
    desc: meta.desc,
    owner: meta.owner || "",
    embedUrl: buildEmbedUrl(bvid, meta.cid)
  };
}

async function getMetadata(bvid) {
  const cached = getCached(bvid);
  if (cached) return cached;
  if (inFlight.has(bvid)) return inFlight.get(bvid);

  const promise = loadMetadata(bvid)
    .then(data => {
      setCached(bvid, data);
      return data;
    })
    .finally(() => inFlight.delete(bvid));
  inFlight.set(bvid, promise);
  return promise;
}

router.post("/bilibili", authMiddleware, async (req, res) => {
  try {
    const bvid = extractBvid(req.body && req.body.url);
    if (!bvid) return res.status(400).json({ ok: false, error: "未识别到 B站 BV 号" });
    const metadata = await getMetadata(bvid);
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.json({ ok: true, ...metadata });
  } catch (error) {
    console.error("[replay meta]", error);
    return res.status(502).json({ ok: false, error: "抓取失败" });
  }
});

module.exports = router;
