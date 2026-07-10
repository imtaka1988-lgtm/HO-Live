/**
 * 懂球帝文章抓取服务。
 * 列表短缓存，正文长缓存，并合并相同并发请求。
 */
const https = require("https");

const CATEGORY_MAP = {
  toutiao: 56,
  kuaixun: 57,
  shendu: 232,
  yingchao: 3,
  xijia: 4,
  yijia: 5,
  dejia: 6
};

const LIST_CACHE_TTL_MS = Number.parseInt(process.env.ARTICLE_LIST_CACHE_TTL_MS || "300000", 10) || 300000;
const DETAIL_CACHE_TTL_MS = Number.parseInt(process.env.ARTICLE_DETAIL_CACHE_TTL_MS || "1800000", 10) || 1800000;
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.ARTICLE_FETCH_TIMEOUT_MS || "8000", 10) || 8000;
const MAX_RESPONSE_BYTES = Number.parseInt(process.env.ARTICLE_MAX_RESPONSE_BYTES || "3145728", 10) || 3145728;
const MAX_REDIRECTS = 3;
const agent = new https.Agent({ keepAlive: true, maxSockets: 10, timeout: FETCH_TIMEOUT_MS });
const listCache = new Map();
const detailCache = new Map();
const inFlight = new Map();

function allowedHost(hostname) {
  return hostname === "dongqiudi.com" || hostname.endsWith(".dongqiudi.com");
}

function fetchText(inputUrl, options = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(inputUrl);
    } catch (_) {
      reject(new Error("invalid upstream URL"));
      return;
    }
    if (parsed.protocol !== "https:" || !allowedHost(parsed.hostname)) {
      reject(new Error("upstream URL not allowed"));
      return;
    }

    const request = https.get(parsed, {
      agent,
      timeout: FETCH_TIMEOUT_MS,
      headers: {
        "User-Agent": "HO-Live/1.0",
        Accept: options.accept || "application/json, text/plain, */*"
      }
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirects >= MAX_REDIRECTS) {
          reject(new Error("too many upstream redirects"));
          return;
        }
        const nextUrl = new URL(response.headers.location, parsed).toString();
        resolve(fetchText(nextUrl, options, redirects + 1));
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`懂球帝响应异常：${response.statusCode}`));
        return;
      }

      let body = "";
      let size = 0;
      response.setEncoding("utf8");
      response.on("data", chunk => {
        size += Buffer.byteLength(chunk);
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error("upstream response too large"));
          return;
        }
        body += chunk;
      });
      response.on("end", () => resolve(body));
    });
    request.on("timeout", () => request.destroy(new Error("upstream request timeout")));
    request.on("error", reject);
  });
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanArticleId(articleId) {
  const id = String(articleId || "").trim();
  return /^\d{1,20}$/.test(id) ? id : "";
}

function cachedValue(cache, key, ttlMs) {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.ts >= ttlMs) return null;
  return entry.data;
}

async function singleFlight(key, loader) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = loader().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function fetchArticleList(category = "toutiao", limit = 10) {
  const catId = CATEGORY_MAP[category];
  if (!catId) throw new Error("unsupported article category");
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 10, 20));
  const raw = await fetchText(`https://dongqiudi.com/api/app/tabs/web/${catId}.json`);
  const data = JSON.parse(raw);
  const articles = Array.isArray(data.articles) ? data.articles : [];
  return articles.slice(0, safeLimit).map(article => ({
    id: article.id,
    title: String(article.title || "").slice(0, 300),
    published_at: article.published_at || "",
    comments_total: Number(article.comments_total || 0),
    url: `https://www.dongqiudi.com/articles/${article.id}.html`,
    share_url: article.share || "",
    thumb: article.thumb || ""
  }));
}

async function loadArticleDetail(id) {
  const html = await fetchText(`https://m.dongqiudi.com/article_share/${id}.html`, {
    accept: "text/html,application/xhtml+xml"
  });

  const ldMatch = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  let title = "";
  let description = "";
  let images = [];
  let publishedAt = "";
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      title = String(ld.title || ld.headline || "").slice(0, 300);
      description = String(ld.description || "").slice(0, 1000);
      images = Array.isArray(ld.images) ? ld.images : (ld.image ? [ld.image] : []);
      images = images.filter(image => /^https:\/\//i.test(String(image))).slice(0, 20);
      publishedAt = ld.pubDate || ld.datePublished || "";
    } catch (_) {}
  }

  const textBlocks = html.match(/>([^<]{30,})</g) || [];
  const seen = new Set();
  const contentLines = [];
  const skipKeywords = [
    "function(", "window.", "document.", "require(", "module.",
    "_hmt", "sensorsInit", "vConsole", "new Image(", "if(typeof"
  ];
  let contentLength = 0;
  for (const block of textBlocks) {
    const value = decodeEntities(block.slice(1, -1).trim());
    if (!value || value.startsWith("{") || value.startsWith("//")) continue;
    if (skipKeywords.some(keyword => value.includes(keyword))) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    contentLines.push(value);
    contentLength += value.length;
    if (contentLength > 100000) break;
  }

  return {
    id,
    title,
    description,
    content: contentLines.join("\n\n").slice(0, 100000),
    images,
    published_at: publishedAt,
    url: `https://www.dongqiudi.com/articles/${id}.html`
  };
}

async function fetchArticleDetail(articleId) {
  const id = cleanArticleId(articleId);
  if (!id) throw new Error("invalid article ID");
  const cached = cachedValue(detailCache, id, DETAIL_CACHE_TTL_MS);
  if (cached) return cached;

  return singleFlight(`detail:${id}`, async () => {
    try {
      const detail = await loadArticleDetail(id);
      detailCache.set(id, { ts: Date.now(), data: detail });
      return detail;
    } catch (error) {
      const stale = detailCache.get(id);
      if (stale) {
        console.warn(`[articles] serving stale detail ${id}:`, error.message);
        return stale.data;
      }
      throw error;
    }
  });
}

async function fetchHotArticles(category = "toutiao", limit = 6) {
  if (!CATEGORY_MAP[category]) throw new Error("unsupported article category");
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 6, 20));
  const cacheKey = `${category}:${safeLimit}`;
  const cached = cachedValue(listCache, cacheKey, LIST_CACHE_TTL_MS);
  if (cached) return cached;

  return singleFlight(`list:${cacheKey}`, async () => {
    try {
      const list = await fetchArticleList(category, safeLimit);
      const articles = list.map(article => ({
        id: article.id,
        title: article.title,
        description: "",
        content: "",
        images: [],
        published_at: article.published_at,
        url: article.url,
        thumb: article.thumb,
        cover: article.thumb,
        comments_total: article.comments_total
      }));
      listCache.set(cacheKey, { ts: Date.now(), data: articles });
      return articles;
    } catch (error) {
      const stale = listCache.get(cacheKey);
      if (stale) {
        console.warn(`[articles] serving stale list ${cacheKey}:`, error.message);
        return stale.data;
      }
      throw error;
    }
  });
}

async function warmupCache() {
  const categories = Object.keys(CATEGORY_MAP);
  const results = await Promise.allSettled(categories.map(category => fetchHotArticles(category, 20)));
  const failed = results.filter(result => result.status === "rejected");
  if (failed.length) console.warn(`[articles] warmup failed for ${failed.length}/${categories.length} categories`);
}

module.exports = {
  CATEGORY_MAP,
  fetchArticleList,
  fetchArticleDetail,
  fetchHotArticles,
  warmupCache
};
