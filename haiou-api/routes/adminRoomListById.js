const express = require("express");
const authMiddleware = require("../middleware/auth");

function publicStream(stream) {
  return {
    id: stream.id,
    name: stream.name,
    type: stream.type,
    url: stream.url,
    enabled: Number(stream.enabled) === 1,
    priority: stream.priority,
    provider: stream.provider,
    mode: stream.mode,
    app_name: stream.app_name,
    stream_name: stream.stream_name,
    device_policy: stream.device_policy,
    remark: stream.remark,
    default: Number(stream.is_default) === 1
  };
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/rooms", authMiddleware, async (req, res) => {
    try {
      const [rooms] = await pool.query(
        "SELECT id, title, category, status, cover, anchor_name AS anchorName, sort_order AS sortOrder, COALESCE(announcement, '') AS announcement FROM rooms ORDER BY sort_order, id"
      );
      const streamsByRoom = new Map();

      if (rooms.length) {
        const ids = rooms.map(room => room.id);
        const placeholders = ids.map(() => "?").join(",");
        const [streams] = await pool.query(
          `SELECT id, room_id AS roomId, name, type, url, is_default, enabled, priority, provider, mode, app_name, stream_name, device_policy, remark FROM room_streams WHERE room_id IN (${placeholders}) ORDER BY room_id, priority, id`,
          ids
        );
        for (const stream of streams) {
          if (!streamsByRoom.has(stream.roomId)) streamsByRoom.set(stream.roomId, []);
          streamsByRoom.get(stream.roomId).push(publicStream(stream));
        }
      }

      const result = rooms.map(room => {
        const streams = streamsByRoom.get(room.id) || [];
        return { ...room, streams, streamCount: streams.length };
      });
      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true, rooms: result });
    } catch (err) {
      console.error("[admin rooms list]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
