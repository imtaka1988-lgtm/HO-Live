const express = require("express");
const authMiddleware = require("../middleware/auth");

async function loadStreams(pool, roomId) {
  const [streams] = await pool.query(
    "SELECT id, name, type, url, is_default, enabled, priority, provider, mode, app_name, stream_name, device_policy, remark FROM room_streams WHERE room_id = ? ORDER BY priority, id",
    [roomId]
  );
  return streams.map(s => ({ ...s, default: s.is_default === 1, isDefault: undefined, is_default: undefined }));
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/rooms", authMiddleware, async (req, res) => {
    try {
      const [rooms] = await pool.query(
        "SELECT id, title, category, status, cover, anchor_name AS anchorName, sort_order AS sortOrder, COALESCE(announcement, '') AS announcement FROM rooms ORDER BY id ASC"
      );

      for (const room of rooms) {
        room.streams = await loadStreams(pool, room.id);
        room.streamCount = room.streams.length;
      }

      res.json({ ok: true, rooms });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
