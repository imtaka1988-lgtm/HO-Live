const express = require("express");
const authMiddleware = require("../middleware/auth");

let tableReady = false;

async function ensureTable(pool) {
  if (tableReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS site_messages (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, title VARCHAR(120) NOT NULL, content TEXT NOT NULL, is_enabled TINYINT(1) NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0, created_by BIGINT UNSIGNED NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY idx_enabled_sort (is_enabled, sort_order, id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  tableReady = true;
}

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
      await ensureTable(pool);
      const [rows] = await pool.query(
        "SELECT id, title, content, is_enabled AS isEnabled, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt FROM site_messages ORDER BY sort_order ASC, id DESC LIMIT 100"
      );
      res.json({ ok: true, messages: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post("/", authMiddleware, async (req, res) => {
    try {
      await ensureTable(pool);
      const title = cleanText(req.body.title, 80);
      const content = cleanText(req.body.content, 500);
      const isEnabled = req.body.isEnabled === false || req.body.is_enabled === false ? 0 : 1;
      const sortOrder = parseInt(req.body.sortOrder || req.body.sort_order || 0, 10) || 0;

      if (!title) return res.status(400).json({ ok: false, error: "请输入站内信标题" });
      if (!content) return res.status(400).json({ ok: false, error: "请输入站内信内容" });

      const [result] = await pool.query(
        "INSERT INTO site_messages (title, content, is_enabled, sort_order, created_by) VALUES (?, ?, ?, ?, ?)",
        [title, content, isEnabled, sortOrder, req.admin.id]
      );

      res.json({
        ok: true,
        message: {
          id: result.insertId,
          title,
          content,
          isEnabled: !!isEnabled,
          sortOrder
        }
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.delete("/:id", authMiddleware, async (req, res) => {
    try {
      await ensureTable(pool);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ ok: false, error: "无效的站内信 ID" });
      await pool.query("DELETE FROM site_messages WHERE id = ?", [id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
