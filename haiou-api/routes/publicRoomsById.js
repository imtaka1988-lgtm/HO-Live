const express = require("express");

async function loadEnabledStreams(pool, roomId) {
  const [streams] = await pool.query(
    "SELECT id, name, type, url, is_default AS isDefault, enabled, priority FROM room_streams WHERE room_id = ? AND enabled = 1 AND url != '' ORDER BY priority, id",
    [roomId]
  );
  return streams.map(s => ({ ...s, default: s.isDefault === 1, isDefault: undefined }));
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/public/rooms", async (req, res) => {
    try {
      const [rooms] = await pool.query(
        "SELECT id, title, category, status, cover, anchor_avatar AS anchorAvatar, anchor_name AS anchorName, sort_order AS sortOrder, COALESCE(announcement, '') AS announcement FROM rooms ORDER BY id ASC"
      );

      for (const room of rooms) {
        room.streams = await loadEnabledStreams(pool, room.id);
      }

      res.json({ ok: true, rooms });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
