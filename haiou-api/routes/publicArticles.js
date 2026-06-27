/**
 * 公共资讯接口 — 代理懂球帝文章数据给前端
 * GET /api/articles?category=toutiao&limit=6
 * GET /api/articles/:id — 单篇文章详情
 */
const express = require("express");
const { fetchHotArticles, fetchArticleDetail, CATEGORY_MAP } = require("../services/dongqiudi");

const router = express.Router();

// 缓存控制
let _listCache = {};
const LIST_TTL = 5 * 60 * 1000; // 5分钟

router.get("/", async (req, res) => {
  try {
    const category = req.query.category || "toutiao";
    const limit = Math.min(parseInt(req.query.limit) || 6, 20);

    // 验证分类
    if (!CATEGORY_MAP[category]) {
      return res.status(400).json({ ok: false, error: "不支持的分类，可用: " + Object.keys(CATEGORY_MAP).join(", ") });
    }

    const cacheKey = `${category}_${limit}`;
    const cached = _listCache[cacheKey];
    if (cached && Date.now() - cached.ts < LIST_TTL) {
      return res.json(cached.data);
    }

    const articles = await fetchHotArticles(category, limit);

    // 精简返回给前端的字段
    const result = articles.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description ? a.description.slice(0, 200) : "",
      cover: a.cover || a.thumb || "",
      published_at: a.published_at,
      comments_total: a.comments_total || 0,
      url: a.url,
    }));

    const response = { ok: true, category, count: result.length, articles: result };
    _listCache[cacheKey] = { ts: Date.now(), data: response };
    res.json(response);
  } catch (err) {
    console.error("[api error]", err);
    res.status(500).json({ ok: false, error: "获取资讯失败" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "文章 ID 不正确" });

    const detail = await fetchArticleDetail(id);
    if (!detail) return res.status(404).json({ ok: false, error: "文章不存在" });

    res.json({
      ok: true,
      article: {
        id: detail.id,
        title: detail.title,
        content: detail.content,
        images: detail.images,
        published_at: detail.published_at,
        url: detail.url,
      },
    });
  } catch (err) {
    console.error("[api error]", err);
    res.status(500).json({ ok: false, error: "获取文章详情失败" });
  }
});

module.exports = router;
