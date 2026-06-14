const express = require("express");
const https = require("https");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

function decodeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function normalizeUrl(u) {
  if (!u) return "";
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("http://")) return "https://" + u.slice(7);
  return u;
}

function extractBvid(url) {
  const m = String(url || "").match(/BV[0-9A-Za-z]+/);
  return m ? m[0] : "";
}

function getAttr(tag, attrName) {
  const re = new RegExp(attrName + "\\s*=\\s*([\\\"'])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1", "i");
  const m = String(tag || "").match(re);
  return m && m[2] ? decodeHtml(m[2]) : "";
}

function extractMeta(html, key) {
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  const want = String(key || "").toLowerCase();
  for (const tag of tags) {
    const prop = (getAttr(tag, "property") || getAttr(tag, "name")).toLowerCase();
    if (prop !== want) continue;
    const content = getAttr(tag, "content");
    if (content) return content;
  }
  return "";
}

function extractTitle(html) {
  const og = extractMeta(html, "og:title");
  if (og) return og.replace(/_哔哩哔哩_bilibili$/i, "").trim();
  const m = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m && m[1]) return decodeHtml(m[1]).replace(/_哔哩哔哩_bilibili$/i, "").trim();
  return "";
}

function fetchText(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: 9000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "identity",
        "Referer": "https://www.bilibili.com/"
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(fetchText(new URL(res.headers.location, url).toString(), options));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error("B站响应异常：" + res.statusCode));
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => {
        body += chunk;
        if (body.length > 1024 * 1024 * 2) req.destroy(new Error("页面过大"));
      });
      res.on("end", () => resolve(body));
    });
    req.on("timeout", () => req.destroy(new Error("请求超时")));
    req.on("error", reject);
  });
}

async function fetchBilibiliApi(bvid) {
  const apiUrl = "https://api.bilibili.com/x/web-interface/view?bvid=" + encodeURIComponent(bvid);
  const raw = await fetchText(apiUrl, { accept: "application/json,text/plain,*/*" });
  const json = JSON.parse(raw);
  if (!json || json.code !== 0 || !json.data) {
    throw new Error((json && json.message) ? json.message : "B站接口未返回视频信息");
  }
  return json.data;
}

async function fetchBilibiliPageMeta(bvid) {
  const pageUrl = "https://www.bilibili.com/video/" + bvid + "/";
  const html = await fetchText(pageUrl);
  return {
    title: extractTitle(html),
    cover: normalizeUrl(extractMeta(html, "og:image")),
    desc: extractMeta(html, "og:description") || extractMeta(html, "description"),
    cid: ""
  };
}

function buildEmbedUrl(bvid, cid) {
  let url = "https://player.bilibili.com/player.html?isOutside=true&bvid=" + encodeURIComponent(bvid);
  if (cid) url += "&cid=" + encodeURIComponent(String(cid));
  return url + "&p=1&autoplay=0&danmaku=0";
}

router.post("/bilibili", authMiddleware, async (req, res) => {
  try {
    const url = String(req.body && req.body.url || "").trim();
    const bvid = extractBvid(url);
    if (!bvid) return res.status(400).json({ ok: false, error: "未识别到 B站 BV 号" });

    const pageUrl = "https://www.bilibili.com/video/" + bvid + "/";
    let meta;

    try {
      const data = await fetchBilibiliApi(bvid);
      meta = {
        title: data.title || "",
        cover: normalizeUrl(data.pic || ""),
        desc: data.desc || "",
        cid: data.cid || "",
        owner: data.owner && data.owner.name ? data.owner.name : ""
      };
    } catch (apiErr) {
      meta = await fetchBilibiliPageMeta(bvid);
      meta.apiFallbackError = apiErr.message || "B站接口失败";
    }

    res.json({
      ok: true,
      platform: "bilibili",
      bvid,
      pageUrl,
      title: meta.title,
      cover: meta.cover,
      desc: meta.desc,
      owner: meta.owner || "",
      embedUrl: buildEmbedUrl(bvid, meta.cid)
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "抓取失败" });
  }
});

module.exports = router;
