const express = require("express");
const authMiddleware = require("../middleware/auth");

function pickSmallestMissingId(rows) {
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

  router.post("/rooms", authMiddleware, async (req, res) => {
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
      const roomId = pickSmallestMissingId(ids);

      await pool.query(
        "INSERT INTO rooms (id, title, category, status, cover, anchor_name, announcement, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [roomId, title, category, status, cover, anchorName, announcement, sortOrder]
      );

      res.json({
        ok: true,
        room: {
          id: roomId,
          title,
          category,
          status,
          cover,
          anchorName,
          announcement,
          sortOrder
        }
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
