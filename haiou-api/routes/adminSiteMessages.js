const express = require("express");
const authMiddleware = require("../middleware/auth");

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/", authMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id, title, content, is_enabled AS isEnabled, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt FROM site_messages ORDER BY sort_order ASC, id DESC LIMIT 100"
      );
      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true, messages: rows });
    } catch (err) {
      console.error("[admin site messages list]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.post("/", authMiddleware, async (req, res) => {
    try {
      const body = req.body || {};
      const title = cleanText(body.title, 120);
      const content = cleanText(body.content, 5000);
      const isEnabled = body.isEnabled === false || body.is_enabled === false ? 0 : 1;
      const sortOrder = Math.max(-9999, Math.min(Number.parseInt(body.sortOrder ?? body.sort_order ?? 0, 10) || 0, 9999));

      if (!title) return res.status(400).json({ ok: false, error: "请输入站内信标题" });
      if (!content) return res.status(400).json({ ok: false, error: "请输入站内信内容" });

      const [result] = await pool.query(
        "INSERT INTO site_messages (title, content, is_enabled, sort_order, created_by) VALUES (?, ?, ?, ?, ?)",
        [title, content, isEnabled, sortOrder, req.admin.id]
      );
      return res.status(201).json({
        ok: true,
        message: {
          id: result.insertId,
          title,
          content,
          isEnabled: Boolean(isEnabled),
          sortOrder
        }
      });
    } catch (err) {
      console.error("[admin site messages create]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.delete("/:id", authMiddleware, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ ok: false, error: "无效的站内信 ID" });
      }
      const [result] = await pool.query("DELETE FROM site_messages WHERE id = ?", [id]);
      if (result.affectedRows === 0) return res.status(404).json({ ok: false, error: "站内信不存在" });
      return res.json({ ok: true, deletedId: id });
    } catch (err) {
      console.error("[admin site messages delete]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
