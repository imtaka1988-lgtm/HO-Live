const express = require("express");
const userAuthMiddleware = require("../middleware/userAuth");

let tableReady = false;

async function ensureTable(pool) {
  if (tableReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS site_messages (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, title VARCHAR(120) NOT NULL, content TEXT NOT NULL, is_enabled TINYINT(1) NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0, created_by BIGINT UNSIGNED NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY idx_enabled_sort (is_enabled, sort_order, id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  tableReady = true;
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/", userAuthMiddleware, async (req, res) => {
    try {
      await ensureTable(pool);
      const [rows] = await pool.query(
        "SELECT id, title, content, created_at AS createdAt FROM site_messages WHERE is_enabled = 1 ORDER BY sort_order ASC, id DESC LIMIT 50"
      );
      res.json({ ok: true, count: rows.length, messages: rows });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
