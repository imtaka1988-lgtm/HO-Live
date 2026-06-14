const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");

function randomPassword(len) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < (len || 10); i += 1) out += chars[crypto.randomInt(chars.length)];
  return out;
}

async function getAnchor(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, room_id AS roomId, username, display_name AS displayName, status FROM anchors WHERE room_id = ?",
    [roomId]
  );
  return rows[0] || null;
}

async function getRoom(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, title, category, status, cover, anchor_name AS anchorName, COALESCE(announcement, '') AS announcement FROM rooms WHERE id = ?",
    [roomId]
  );
  return rows[0] || null;
}

async function getStreamProfile(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT room_id AS roomId, provider, push_domain AS pushDomain, pull_domain AS pullDomain, app_name AS appName, stream_name AS streamName, obs_server AS obsServer, obs_stream_key AS obsStreamKey, pull_hls_url AS pullHlsUrl, pull_flv_url AS pullFlvUrl, remark FROM room_stream_profiles WHERE room_id = ?",
    [roomId]
  );
  return rows[0] || null;
}

async function getStreams(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, name, type, url, is_default, enabled, priority FROM room_streams WHERE room_id = ? ORDER BY priority, id",
    [roomId]
  );
  return rows.map(function (s) {
    return { id: s.id, name: s.name, type: s.type, url: s.url, default: Number(s.is_default) === 1, enabled: Number(s.enabled) === 1, priority: s.priority };
  });
}

module.exports = function (pool) {
  const router = express.Router();

  router.post("/rooms/:roomId/anchor-bundle/reset-password", authMiddleware, async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId, 10);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });

      const room = await getRoom(pool, roomId);
      if (!room) return res.status(404).json({ ok: false, error: "房间不存在" });

      const anchor = await getAnchor(pool, roomId);
      if (!anchor) return res.status(404).json({ ok: false, error: "该房间还没有主播账号" });

      const password = randomPassword(10);
      const hash = await bcrypt.hash(password, 10);
      await pool.query("UPDATE anchors SET password_hash = ? WHERE id = ?", [hash, anchor.id]);

      res.json({
        ok: true,
        room,
        anchor,
        streamProfile: await getStreamProfile(pool, roomId),
        playbackStreams: await getStreams(pool, roomId),
        generatedPassword: password,
        reset: true
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
