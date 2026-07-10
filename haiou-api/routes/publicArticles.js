const express = require("express");
const { fetchHotArticles, fetchArticleDetail, CATEGORY_MAP } = require("../services/dongqiudi");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const category = String(req.query.category || "toutiao").trim();
    const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 6, 20));
    if (!CATEGORY_MAP[category]) {
      return res.status(400).json({
        ok: false,
        error: "不支持的分类，可用: " + Object.keys(CATEGORY_MAP).join(", ")
      });
    }

    const articles = await fetchHotArticles(category, limit);
    const result = articles.map(article => ({
      id: article.id,
      title: article.title,
      description: article.description ? article.description.slice(0, 200) : "",
      cover: article.cover || article.thumb || "",
      published_at: article.published_at,
      comments_total: article.comments_total || 0,
      url: article.url
    }));

    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json({ ok: true, category, count: result.length, articles: result });
  } catch (err) {
    console.error("[articles list]", err);
    return res.status(502).json({ ok: false, error: "获取资讯失败" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!/^\d{1,20}$/.test(id)) {
      return res.status(400).json({ ok: false, error: "文章 ID 不正确" });
    }

    const detail = await fetchArticleDetail(id);
    if (!detail) return res.status(404).json({ ok: false, error: "文章不存在" });
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
    return res.json({
      ok: true,
      article: {
        id: detail.id,
        title: detail.title,
        description: detail.description,
        content: detail.content,
        images: detail.images,
        published_at: detail.published_at,
        url: detail.url
      }
    });
  } catch (err) {
    console.error("[article detail]", err);
    return res.status(502).json({ ok: false, error: "获取文章详情失败" });
  }
});

module.exports = router;
