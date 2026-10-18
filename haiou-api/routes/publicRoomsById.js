const express = require("express");

function mapStream(stream) {
  return {
    id: stream.id,
    name: stream.name,
    type: stream.type,
    url: stream.url,
    enabled: stream.enabled,
    priority: stream.priority,
    default: stream.isDefault === 1
  };
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/public/rooms", async (req, res) => {
    try {
      const [rooms] = await pool.query(
        "SELECT id, title, category, status, cover, anchor_avatar AS anchorAvatar, anchor_name AS anchorName, sort_order AS sortOrder, COALESCE(announcement, '') AS announcement FROM rooms ORDER BY sort_order, id"
      );

      const streamsByRoom = new Map();
      if (rooms.length > 0) {
        const ids = rooms.map(room => room.id);
        const placeholders = ids.map(() => "?").join(",");
        const [streams] = await pool.query(
          `SELECT id, room_id AS roomId, name, type, url, is_default AS isDefault, enabled, priority FROM room_streams WHERE room_id IN (${placeholders}) AND enabled = 1 AND url != '' ORDER BY room_id, priority, id`,
          ids
        );
        for (const stream of streams) {
          if (!streamsByRoom.has(stream.roomId)) streamsByRoom.set(stream.roomId, []);
          streamsByRoom.get(stream.roomId).push(mapStream(stream));
        }
      }

      const result = rooms.map(room => ({
        ...room,
        streams: streamsByRoom.get(room.id) || []
      }));
      res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
      return res.json({ ok: true, rooms: result });
    } catch (err) {
      console.error("[public rooms]", err);
      return res.status(500).json({ ok: false, error: "服务暂时不可用" });
    }
  });

  return router;
};
