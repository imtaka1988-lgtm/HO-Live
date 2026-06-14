const express = require("express");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../middleware/auth");

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

function randomPassword(len) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < (len || 10); i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function cleanDomain(value) {
  return String(value || "").trim().replace(/^https?:\/\//i, "").replace(/^rtmp:\/\//i, "").replace(/\/+$/, "");
}

function buildStreamProfile(roomId) {
  const appName = String(process.env.LIVE_APP_NAME || "live").trim() || "live";
  const streamName = "room" + roomId;
  const pushDomain = cleanDomain(process.env.LIVE_PUSH_DOMAIN || "");
  const pullDomain = cleanDomain(process.env.LIVE_PULL_DOMAIN || "");
  const pushProtocol = String(process.env.LIVE_PUSH_PROTOCOL || "rtmp").replace(":", "") || "rtmp";
  const obsServer = pushDomain ? (pushProtocol + "://" + pushDomain + "/" + appName) : "";
  const obsStreamKey = streamName;
  const pullHlsUrl = pullDomain ? ("https://" + pullDomain + "/" + appName + "/" + streamName + ".m3u8") : "";
  const pullFlvUrl = pullDomain ? ("https://" + pullDomain + "/" + appName + "/" + streamName + ".flv") : "";

  return {
    provider: process.env.LIVE_PROVIDER || "manual",
    pushDomain,
    pullDomain,
    appName,
    streamName,
    obsServer,
    obsStreamKey,
    pullHlsUrl,
    pullFlvUrl,
    remark: "系统随房间自动生成"
  };
}

async function insertDefaultPlaybackStreams(conn, roomId, profile) {
  if (!profile.pullHlsUrl && !profile.pullFlvUrl) return [];
  const inserted = [];

  if (profile.pullHlsUrl) {
    const [hls] = await conn.query(
      "INSERT INTO room_streams (room_id, name, type, url, is_default, enabled, priority, provider, mode, app_name, stream_name, device_policy, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [roomId, "主线路 HLS", "hls", profile.pullHlsUrl, 1, 1, 1, profile.provider, "room_fixed", profile.appName, profile.streamName, "auto", "系统随房间自动生成"]
    );
    inserted.push({ id: hls.insertId, type: "hls", url: profile.pullHlsUrl });
  }

  if (profile.pullFlvUrl) {
    const [flv] = await conn.query(
      "INSERT INTO room_streams (room_id, name, type, url, is_default, enabled, priority, provider, mode, app_name, stream_name, device_policy, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [roomId, "极速线路 FLV", "flv", profile.pullFlvUrl, profile.pullHlsUrl ? 0 : 1, 1, 2, profile.provider, "room_fixed", profile.appName, profile.streamName, "auto", "系统随房间自动生成"]
    );
    inserted.push({ id: flv.insertId, type: "flv", url: profile.pullFlvUrl });
  }

  return inserted;
}

module.exports = function (pool) {
  const router = express.Router();

  router.post("/rooms", authMiddleware, async (req, res) => {
    let conn = null;
    try {
      await ensureAnchorTables(pool);

      const title = (req.body.title || "新直播间").trim();
      const category = req.body.category || "football";
      const status = req.body.status || "offline";
      const cover = req.body.cover || "";
      const anchorName = req.body.anchor_name || req.body.anchorName || "";
      const announcement = req.body.announcement || "";
      const sortOrder = parseInt(req.body.sort_order || req.body.sortOrder || 0) || 0;

      if (!["football", "basketball", "analysis"].includes(category)) {
        return res.status(400).json({ ok: false, error: "无效的分类" });
      }

      if (!["live", "offline", "pending"].includes(status)) {
        return res.status(400).json({ ok: false, error: "无效的状态" });
      }

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [roomResult] = await conn.query(
        "INSERT INTO rooms (title, category, status, cover, anchor_name, announcement, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [title, category, status, cover, anchorName, announcement, sortOrder]
      );

      const roomId = roomResult.insertId;
      const username = "anchor_room_" + roomId;
      const password = randomPassword(10);
      const passwordHash = await bcrypt.hash(password, 10);
      const displayName = anchorName || title || ("房间" + roomId + "主播");
      const streamProfile = buildStreamProfile(roomId);

      const [anchorResult] = await conn.query(
        "INSERT INTO anchors (room_id, username, password_hash, display_name, status) VALUES (?, ?, ?, ?, 'active')",
        [roomId, username, passwordHash, displayName]
      );

      await conn.query(
        "INSERT INTO room_stream_profiles (room_id, provider, push_domain, pull_domain, app_name, stream_name, obs_server, obs_stream_key, pull_hls_url, pull_flv_url, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [roomId, streamProfile.provider, streamProfile.pushDomain, streamProfile.pullDomain, streamProfile.appName, streamProfile.streamName, streamProfile.obsServer, streamProfile.obsStreamKey, streamProfile.pullHlsUrl, streamProfile.pullFlvUrl, streamProfile.remark]
      );

      const playbackStreams = await insertDefaultPlaybackStreams(conn, roomId, streamProfile);

      await conn.commit();

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
        },
        anchor: {
          id: anchorResult.insertId,
          roomId,
          username,
          password,
          displayName,
          status: "active"
        },
        streamProfile,
        playbackStreams
      });
    } catch (err) {
      if (conn) {
        try { await conn.rollback(); } catch (e) {}
      }
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  return router;
};
