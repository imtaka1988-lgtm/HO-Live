const express = require("express");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../middleware/auth");

let tablesReady = false;

async function ensureTables(pool) {
  if (tablesReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS anchors (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, room_id INT UNSIGNED NOT NULL, username VARCHAR(64) NOT NULL, password_hash VARCHAR(255) NOT NULL, display_name VARCHAR(100) NOT NULL DEFAULT '', status VARCHAR(24) NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_anchor_room (room_id), UNIQUE KEY uniq_anchor_username (username), KEY idx_anchor_status (status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  await pool.query(
    "CREATE TABLE IF NOT EXISTS room_stream_profiles (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, room_id INT UNSIGNED NOT NULL, provider VARCHAR(32) NOT NULL DEFAULT 'manual', push_domain VARCHAR(128) NOT NULL DEFAULT '', pull_domain VARCHAR(128) NOT NULL DEFAULT '', app_name VARCHAR(64) NOT NULL DEFAULT 'live', stream_name VARCHAR(128) NOT NULL, obs_server VARCHAR(255) NOT NULL DEFAULT '', obs_stream_key VARCHAR(255) NOT NULL DEFAULT '', pull_hls_url VARCHAR(500) NOT NULL DEFAULT '', pull_flv_url VARCHAR(500) NOT NULL DEFAULT '', remark VARCHAR(500) NOT NULL DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_stream_profile_room (room_id), KEY idx_stream_name (stream_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  tablesReady = true;
}

function randomPassword(len) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < (len || 10); i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function cleanDomain(value) {
  return String(value || "").trim().replace(/^https?:\/\//i, "").replace(/^rtmp:\/\//i, "").replace(/\/+$/, "");
}

function buildDefaultProfile(roomId) {
  const appName = String(process.env.LIVE_APP_NAME || "live").trim() || "live";
  const streamName = "room" + roomId;
  const pushDomain = cleanDomain(process.env.LIVE_PUSH_DOMAIN || "");
  const pullDomain = cleanDomain(process.env.LIVE_PULL_DOMAIN || "");
  const pushProtocol = String(process.env.LIVE_PUSH_PROTOCOL || "rtmp").replace(":", "") || "rtmp";
  return {
    provider: process.env.LIVE_PROVIDER || "manual",
    pushDomain,
    pullDomain,
    appName,
    streamName,
    obsServer: pushDomain ? (pushProtocol + "://" + pushDomain + "/" + appName) : "",
    obsStreamKey: streamName,
    pullHlsUrl: pullDomain ? ("https://" + pullDomain + "/" + appName + "/" + streamName + ".m3u8") : "",
    pullFlvUrl: pullDomain ? ("https://" + pullDomain + "/" + appName + "/" + streamName + ".flv") : "",
    remark: "系统随房间自动生成"
  };
}

async function getRoom(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, title, category, status, cover, anchor_name AS anchorName, COALESCE(announcement, '') AS announcement FROM rooms WHERE id = ?",
    [roomId]
  );
  return rows[0] || null;
}

async function ensureProfile(pool, roomId) {
  const defaults = buildDefaultProfile(roomId);
  await pool.query(
    "INSERT IGNORE INTO room_stream_profiles (room_id, provider, push_domain, pull_domain, app_name, stream_name, obs_server, obs_stream_key, pull_hls_url, pull_flv_url, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [roomId, defaults.provider, defaults.pushDomain, defaults.pullDomain, defaults.appName, defaults.streamName, defaults.obsServer, defaults.obsStreamKey, defaults.pullHlsUrl, defaults.pullFlvUrl, defaults.remark]
  );

  const [rows] = await pool.query(
    "SELECT room_id AS roomId, provider, push_domain AS pushDomain, pull_domain AS pullDomain, app_name AS appName, stream_name AS streamName, obs_server AS obsServer, obs_stream_key AS obsStreamKey, pull_hls_url AS pullHlsUrl, pull_flv_url AS pullFlvUrl, remark FROM room_stream_profiles WHERE room_id = ?",
    [roomId]
  );
  return rows[0] || defaults;
}

async function getAnchor(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, room_id AS roomId, username, display_name AS displayName, status, created_at AS createdAt, updated_at AS updatedAt FROM anchors WHERE room_id = ?",
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

async function buildBundle(pool, roomId) {
  const room = await getRoom(pool, roomId);
  if (!room) return null;
  const anchor = await getAnchor(pool, roomId);
  const streamProfile = await ensureProfile(pool, roomId);
  const playbackStreams = await getStreams(pool, roomId);
  return { room, anchor, streamProfile, playbackStreams };
}

async function createAnchor(pool, room) {
  const existing = await getAnchor(pool, room.id);
  if (existing) return { anchor: existing, password: "", created: false };

  const username = "anchor_room_" + room.id;
  const password = randomPassword(10);
  const hash = await bcrypt.hash(password, 10);
  const displayName = room.anchorName || room.title || ("房间" + room.id + "主播");
  const [result] = await pool.query(
    "INSERT INTO anchors (room_id, username, password_hash, display_name, status) VALUES (?, ?, ?, ?, 'active')",
    [room.id, username, hash, displayName]
  );
  return { anchor: { id: result.insertId, roomId: room.id, username, displayName, status: "active" }, password, created: true };
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/rooms/:roomId/anchor-bundle", authMiddleware, async (req, res) => {
    try {
      await ensureTables(pool);
      const roomId = parseInt(req.params.roomId, 10);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const bundle = await buildBundle(pool, roomId);
      if (!bundle) return res.status(404).json({ ok: false, error: "房间不存在" });
      res.json({ ok: true, ...bundle });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post("/rooms/:roomId/anchor-bundle", authMiddleware, async (req, res) => {
    try {
      await ensureTables(pool);
      const roomId = parseInt(req.params.roomId, 10);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const room = await getRoom(pool, roomId);
      if (!room) return res.status(404).json({ ok: false, error: "房间不存在" });
      const created = await createAnchor(pool, room);
      const bundle = await buildBundle(pool, roomId);
      res.json({ ok: true, ...bundle, generatedPassword: created.password, created: created.created });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.put("/rooms/:roomId/anchor-bundle/stream-profile", authMiddleware, async (req, res) => {
    try {
      await ensureTables(pool);
      const roomId = parseInt(req.params.roomId, 10);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const room = await getRoom(pool, roomId);
      if (!room) return res.status(404).json({ ok: false, error: "房间不存在" });
      await ensureProfile(pool, roomId);

      const obsServer = String((req.body && req.body.obsServer !== undefined ? req.body.obsServer : req.body.obs_server) || "").trim();
      const obsStreamKey = String((req.body && req.body.obsStreamKey !== undefined ? req.body.obsStreamKey : req.body.obs_stream_key) || "").trim();
      await pool.query(
        "UPDATE room_stream_profiles SET obs_server = ?, obs_stream_key = ? WHERE room_id = ?",
        [obsServer, obsStreamKey, roomId]
      );

      const bundle = await buildBundle(pool, roomId);
      res.json({ ok: true, ...bundle, saved: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post("/rooms/:roomId/anchor-bundle/reset-password", authMiddleware, async (req, res) => {
    try {
      await ensureTables(pool);
      const roomId = parseInt(req.params.roomId, 10);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const anchor = await getAnchor(pool, roomId);
      if (!anchor) return res.status(404).json({ ok: false, error: "该房间还没有主播账号" });
      const password = randomPassword(10);
      const hash = await bcrypt.hash(password, 10);
      await pool.query("UPDATE anchors SET password_hash = ? WHERE id = ?", [hash, anchor.id]);
      const bundle = await buildBundle(pool, roomId);
      res.json({ ok: true, ...bundle, generatedPassword: password, reset: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
