const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const anchorAuthMiddleware = require("../middleware/anchorAuth");

let anchorTablesReady = false;

async function ensureAnchorTables(pool) {
  if (anchorTablesReady) return;

  await pool.query(
    "CREATE TABLE IF NOT EXISTS anchors (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, room_id INT UNSIGNED NOT NULL, username VARCHAR(64) NOT NULL, password_hash VARCHAR(255) NOT NULL, display_name VARCHAR(100) NOT NULL DEFAULT '', status VARCHAR(24) NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_anchor_room (room_id), UNIQUE KEY uniq_anchor_username (username), KEY idx_anchor_status (status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );

  await pool.query(
    "CREATE TABLE IF NOT EXISTS room_stream_profiles (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, room_id INT UNSIGNED NOT NULL, provider VARCHAR(32) NOT NULL DEFAULT 'manual', push_domain VARCHAR(128) NOT NULL DEFAULT '', pull_domain VARCHAR(128) NOT NULL DEFAULT '', app_name VARCHAR(64) NOT NULL DEFAULT 'live', stream_name VARCHAR(128) NOT NULL, obs_server VARCHAR(255) NOT NULL DEFAULT '', obs_stream_key VARCHAR(255) NOT NULL DEFAULT '', pull_hls_url VARCHAR(500) NOT NULL DEFAULT '', pull_flv_url VARCHAR(500) NOT NULL DEFAULT '', remark VARCHAR(500) NOT NULL DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_stream_profile_room (room_id), KEY idx_stream_name (stream_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );

  anchorTablesReady = true;
}

function cleanRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title || "",
    category: row.category || "football",
    status: row.status || "offline",
    cover: row.cover || "",
    anchorName: row.anchorName || row.anchor_name || "",
    announcement: row.announcement || "",
    sortOrder: row.sortOrder || row.sort_order || 0
  };
}

function defaultStreamName(roomId) {
  return "room" + roomId;
}

async function ensureRoomProfile(pool, roomId) {
  const streamName = defaultStreamName(roomId);
  await pool.query(
    "INSERT IGNORE INTO room_stream_profiles (room_id, stream_name) VALUES (?, ?)",
    [roomId, streamName]
  );

  const [rows] = await pool.query(
    "SELECT room_id AS roomId, provider, push_domain AS pushDomain, pull_domain AS pullDomain, app_name AS appName, stream_name AS streamName, obs_server AS obsServer, obs_stream_key AS obsStreamKey, pull_hls_url AS pullHlsUrl, pull_flv_url AS pullFlvUrl, remark FROM room_stream_profiles WHERE room_id = ?",
    [roomId]
  );

  return rows[0] || null;
}

async function getRoom(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, title, category, status, cover, anchor_name AS anchorName, sort_order AS sortOrder, COALESCE(announcement, '') AS announcement FROM rooms WHERE id = ?",
    [roomId]
  );
  return cleanRoom(rows[0]);
}

async function getPlaybackStreams(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, name, type, url, is_default, enabled, priority FROM room_streams WHERE room_id = ? ORDER BY priority, id",
    [roomId]
  );
  return rows.map(function (s) {
    return {
      id: s.id,
      name: s.name || "",
      type: s.type || "hls",
      url: s.url || "",
      enabled: Number(s.enabled) === 1,
      default: Number(s.is_default) === 1,
      priority: s.priority || 99
    };
  });
}

module.exports = function (pool) {
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET;

  router.post("/login", async (req, res) => {
    try {
      await ensureAnchorTables(pool);

      const username = String((req.body && req.body.username) || "").trim();
      const password = String((req.body && req.body.password) || "");
      if (!username || !password) {
        return res.status(400).json({ ok: false, error: "请输入主播账号和密码" });
      }

      const [rows] = await pool.query(
        "SELECT id, room_id AS roomId, username, password_hash AS passwordHash, display_name AS displayName, status FROM anchors WHERE username = ?",
        [username]
      );

      if (!rows.length) return res.status(401).json({ ok: false, error: "主播账号或密码错误" });
      const anchor = rows[0];
      if (anchor.status !== "active") return res.status(403).json({ ok: false, error: "主播账号已停用" });

      const valid = await bcrypt.compare(password, anchor.passwordHash);
      if (!valid) return res.status(401).json({ ok: false, error: "主播账号或密码错误" });

      const token = jwt.sign(
        { type: "anchor", id: anchor.id, username: anchor.username, roomId: anchor.roomId },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({
        ok: true,
        token,
        anchor: {
          id: anchor.id,
          username: anchor.username,
          displayName: anchor.displayName || "",
          roomId: anchor.roomId
        }
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get("/me", anchorAuthMiddleware, async (req, res) => {
    try {
      await ensureAnchorTables(pool);

      const [rows] = await pool.query(
        "SELECT id, room_id AS roomId, username, display_name AS displayName, status FROM anchors WHERE id = ?",
        [req.anchor.id]
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: "主播账号不存在" });
      if (rows[0].status !== "active") return res.status(403).json({ ok: false, error: "主播账号已停用" });

      const room = await getRoom(pool, rows[0].roomId);
      res.json({ ok: true, anchor: rows[0], room });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get("/room", anchorAuthMiddleware, async (req, res) => {
    try {
      await ensureAnchorTables(pool);
      const room = await getRoom(pool, req.anchor.roomId);
      if (!room) return res.status(404).json({ ok: false, error: "绑定房间不存在" });
      res.json({ ok: true, room });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.put("/room", anchorAuthMiddleware, async (req, res) => {
    try {
      await ensureAnchorTables(pool);

      const allowed = ["title", "cover", "anchor_name", "announcement"];
      const data = req.body || {};
      const update = {};

      if (data.anchorName !== undefined && data.anchor_name === undefined) {
        data.anchor_name = data.anchorName;
      }

      allowed.forEach(function (key) {
        if (data[key] !== undefined) update[key] = String(data[key] || "").trim();
      });

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ ok: false, error: "没有要更新的字段" });
      }

      const set = Object.keys(update).map(function (key) { return key + " = ?"; }).join(", ");
      const vals = Object.keys(update).map(function (key) { return update[key]; });
      vals.push(req.anchor.roomId);

      const [r] = await pool.query("UPDATE rooms SET " + set + " WHERE id = ?", vals);
      if (r.affectedRows === 0) return res.status(404).json({ ok: false, error: "绑定房间不存在" });

      const room = await getRoom(pool, req.anchor.roomId);
      res.json({ ok: true, updated: r.affectedRows, fields: Object.keys(update), room });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get("/stream-info", anchorAuthMiddleware, async (req, res) => {
    try {
      await ensureAnchorTables(pool);

      const room = await getRoom(pool, req.anchor.roomId);
      if (!room) return res.status(404).json({ ok: false, error: "绑定房间不存在" });

      const profile = await ensureRoomProfile(pool, req.anchor.roomId);
      const playbackStreams = await getPlaybackStreams(pool, req.anchor.roomId);

      res.json({
        ok: true,
        room,
        streamInfo: {
          provider: profile ? profile.provider : "manual",
          appName: profile ? profile.appName : "live",
          streamName: profile ? profile.streamName : defaultStreamName(req.anchor.roomId),
          obsServer: profile ? profile.obsServer : "",
          obsStreamKey: profile ? profile.obsStreamKey : "",
          pushDomain: profile ? profile.pushDomain : "",
          pullDomain: profile ? profile.pullDomain : "",
          pullHlsUrl: profile ? profile.pullHlsUrl : "",
          pullFlvUrl: profile ? profile.pullFlvUrl : "",
          remark: profile ? profile.remark : ""
        },
        playbackStreams
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
