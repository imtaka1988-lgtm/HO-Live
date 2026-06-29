const express = require("express");
const authMiddleware = require("../middleware/auth");

function pickSmallestMissingRoomId(rows) {
  let nextId = 1;
  for (const row of rows) {
    const id = Number(row.id);
    if (id === nextId) nextId += 1;
    else if (id > nextId) break;
  }
  return nextId;
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString(), service: "haiou-api" });
  });

  router.get("/health/db", async (req, res) => {
    try {
      await pool.query("SELECT 1 AS alive");
      res.json({ ok: true, db: "ok" });
    } catch (err) {
      res.status(500).json({ ok: false, error: "db unavailable" });
    }
  });

  router.get("/health/tables", async (req, res) => {
    try {
      await pool.query("SELECT 1 FROM rooms LIMIT 1");
      await pool.query("SELECT 1 FROM room_streams LIMIT 1");
      res.json({ ok: true, tables: "ok" });
    } catch (err) {
      res.status(500).json({ ok: false, error: "tables unavailable" });
    }
  });

  router.post("/admin/rooms", authMiddleware, async (req, res) => {
    try {
      const title = (req.body.title || "新直播间").trim();
      const category = req.body.category || "football";
      const status = req.body.status || "offline";
      const cover = req.body.cover || "";
      const anchorName = req.body.anchor_name || req.body.anchorName || "";
      const announcement = req.body.announcement || "";
      const sortOrder = parseInt(req.body.sort_order || req.body.sortOrder || 0, 10) || 0;

      if (!["football", "basketball", "analysis"].includes(category)) {
        return res.status(400).json({ ok: false, error: "无效的分类" });
      }
      if (!["live", "offline", "pending"].includes(status)) {
        return res.status(400).json({ ok: false, error: "无效的状态" });
      }

      const [ids] = await pool.query("SELECT id FROM rooms ORDER BY id ASC");
      const roomId = pickSmallestMissingRoomId(ids);

      await pool.query(
        "INSERT INTO rooms (id, title, category, status, cover, anchor_name, announcement, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [roomId, title, category, status, cover, anchorName, announcement, sortOrder]
      );

      res.json({
        ok: true,
        room: { id: roomId, title, category, status, cover, anchorName, announcement, sortOrder }
      });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
