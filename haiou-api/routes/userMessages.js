const express = require("express");
const userAuthMiddleware = require("../middleware/userAuth");

module.exports = function (pool) {
  const router = express.Router();

  router.get("/", userAuthMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id, title, content, created_at AS createdAt FROM site_messages WHERE is_enabled = 1 ORDER BY sort_order ASC, id DESC LIMIT 50"
      );
      res.setHeader("Cache-Control", "private, max-age=30");
      return res.json({ ok: true, count: rows.length, messages: rows });
    } catch (err) {
      console.error("[user messages]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
