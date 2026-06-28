/**
 * 懂球帝文章抓取服务 — Node.js 版
 * 公开 JSON 接口，无需 API Key
 */
const https = require("https");

const CATEGORY_MAP = {
  toutiao: 56,
  kuaixun: 57,
  shendu: 232,
  yingchao: 3,
  xijia: 4,
  yijia: 5,
  dejia: 6,
};

// 缓存：每5分钟刷新
let _cache = {};
const CACHE_TTL = 5 * 60 * 1000;

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: 12000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: options.accept || "application/json, text/plain, */*",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(fetch(res.headers.location, options));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error("懂球帝响应异常：" + res.statusCode));
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve(body));
    });
    req.on("timeout", () => { req.destroy(new Error("请求超时")); });
    req.on("error", reject);
  });
}

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 获取文章列表
 * @param {string} category - toutiao/kuaixun/shendu/yingchao/xijia/yijia/dejia
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function fetchArticleList(category = "toutiao", limit = 10) {
  const catId = CATEGORY_MAP[category] || 56;
  const url = `https://dongqiudi.com/api/app/tabs/web/${catId}.json`;
  const raw = await fetch(url);
  const data = JSON.parse(raw);
  const articles = data.articles || [];
  return articles.slice(0, limit).map((a) => ({
    id: a.id,
    title: a.title || "",
    published_at: a.published_at || "",
    comments_total: a.comments_total || 0,
    url: `https://www.dongqiudi.com/articles/${a.id}.html`,
    share_url: a.share || "",
    thumb: a.thumb || "",
  }));
}

/**
 * 抓取单篇文章详情
 * @param {number|string} articleId
 * @returns {Promise<Object|null>}
 */
async function fetchArticleDetail(articleId) {
  const url = `https://m.dongqiudi.com/article_share/${articleId}.html`;
  const html = await fetch(url, { accept: "text/html,application/xhtml+xml" });

  // 提取 JSON-LD
  const ldMatch = html.match(
    /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/
  );
  let title = "",
    description = "",
    images = [],
    published_at = "";
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      title = ld.title || "";
      description = ld.description || "";
      images = ld.images || [];
      published_at = ld.pubDate || "";
    } catch (_) {}
  }

  // 提取正文
  const textBlocks = html.match(/>([^<]{30,})</g) || [];
  const seen = new Set();
  const contentLines = [];
  const skipKw = [
    "function(", "window.", "document.", "require(", "module.",
    "_hmt", "sensorsInit", "vConsole", "new Image(", "if(typeof"
  ];
  for (const block of textBlocks) {
    let text = block.slice(1, -1).trim();
    text = text.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    if (text.startsWith("{") || text.startsWith("//")) continue;
    if (skipKw.some((kw) => text.includes(kw))) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    contentLines.push(text);
  }
  const content = contentLines.join("\n\n");

  return {
    id: articleId,
    title,
    description,
    content,
    images,
    published_at,
    url: `https://www.dongqiudi.com/articles/${articleId}.html`,
  };
}

/**
 * 获取热点文章（含详情），带缓存
 * @param {string} category
 * @param {number} limit
 * @returns {Promise<Array>}
 */
/**
 * 预热所有分类缓存（启动时+定时调用）— 只抓列表，不抓详情
 */
async function warmupCache() {
  const cats = ["toutiao", "kuaixun", "shendu", "yingchao", "xijia", "yijia", "dejia"];
  for (const cat of cats) {
    try { await fetchHotArticles(cat, 20); } catch (_) {}
  }
}

/**
 * 获取热点文章列表（不含正文详情，速度快）
 * 正文在用户点击时通过 /api/articles/:id 按需加载
 */
async function fetchHotArticles(category = "toutiao", limit = 6) {
  const cacheKey = `${category}_${limit}`;
  const cached = _cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const list = await fetchArticleList(category, limit);
  // 只返回列表数据，不抓详情——正文在点击时按需加载
  const articles = list.map((a) => ({
    id: a.id,
    title: a.title || "",
    description: "", // 正文按需加载
    content: "",
    images: [],      // 配图按需加载
    published_at: a.published_at || "",
    url: `https://www.dongqiudi.com/articles/${a.id}.html`,
    thumb: a.thumb || "",
    cover: a.thumb || "",
    comments_total: a.comments_total || 0,
  }));

  _cache[cacheKey] = { ts: Date.now(), data: articles };
  return articles;
}

module.exports = { fetchArticleList, fetchArticleDetail, fetchHotArticles, warmupCache, CATEGORY_MAP };
