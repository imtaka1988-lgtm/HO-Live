const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");

let ready = false;

async function ensureTables(pool) {
  if (ready) return;
  await pool.query("CREATE TABLE IF NOT EXISTS anchors (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, room_id INT UNSIGNED NOT NULL, username VARCHAR(64) NOT NULL, password_hash VARCHAR(255) NOT NULL, display_name VARCHAR(100) NOT NULL DEFAULT '', status VARCHAR(24) NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_anchor_room (room_id), UNIQUE KEY uniq_anchor_username (username), KEY idx_anchor_status (status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await pool.query("CREATE TABLE IF NOT EXISTS room_stream_profiles (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, room_id INT UNSIGNED NOT NULL, provider VARCHAR(32) NOT NULL DEFAULT 'manual', push_domain VARCHAR(128) NOT NULL DEFAULT '', pull_domain VARCHAR(128) NOT NULL DEFAULT '', app_name VARCHAR(64) NOT NULL DEFAULT 'live', stream_name VARCHAR(128) NOT NULL, obs_server VARCHAR(255) NOT NULL DEFAULT '', obs_stream_key VARCHAR(255) NOT NULL DEFAULT '', pull_hls_url VARCHAR(500) NOT NULL DEFAULT '', pull_flv_url VARCHAR(500) NOT NULL DEFAULT '', remark VARCHAR(500) NOT NULL DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_stream_profile_room (room_id), KEY idx_stream_name (stream_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await pool.query("CREATE TABLE IF NOT EXISTS obs_template (id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1, obs_server_template VARCHAR(255) NOT NULL DEFAULT '', obs_key_template VARCHAR(255) NOT NULL DEFAULT 'room{id}', hls_url_template VARCHAR(500) NOT NULL DEFAULT '', flv_url_template VARCHAR(500) NOT NULL DEFAULT '', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await pool.query("INSERT IGNORE INTO obs_template (id, obs_server_template, obs_key_template, hls_url_template, flv_url_template) VALUES (1, '', 'room{id}', '', '')");
  ready = true;
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i += 1) out += chars[crypto.randomInt(chars.length)];
  return out;
}

function applyTpl(value, roomId, streamName) {
  return String(value || '').replace(/\{id\}/g, String(roomId)).replace(/\{roomId\}/g, String(roomId)).replace(/\{streamName\}/g, streamName);
}

async function getTemplate(pool) {
  await ensureTables(pool);
  const [rows] = await pool.query("SELECT obs_server_template AS obsServerTemplate, obs_key_template AS obsKeyTemplate, hls_url_template AS hlsUrlTemplate, flv_url_template AS flvUrlTemplate FROM obs_template WHERE id = 1");
  return rows[0] || { obsServerTemplate: '', obsKeyTemplate: 'room{id}', hlsUrlTemplate: '', flvUrlTemplate: '' };
}

async function insertStream(conn, roomId, profile, type, url, isDefault, priority, name) {
  if (!url) return null;
  const [r] = await conn.query(
    "INSERT INTO room_streams (room_id, name, type, url, is_default, enabled, priority, provider, mode, app_name, stream_name, device_policy, remark) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'room_fixed', ?, ?, 'auto', '系统随房间自动生成')",
    [roomId, name, type, url, isDefault, priority, profile.provider, profile.appName, profile.streamName]
  );
  return { id: r.insertId, type, url };
}

module.exports = function (pool) {
  const router = express.Router();

  router.post("/rooms", authMiddleware, async (req, res) => {
    let conn = null;
    try {
      await ensureTables(pool);
      const title = String(req.body.title || "新直播间").trim();
      const category = req.body.category || "football";
      const status = req.body.status || "offline";
      const cover = req.body.cover || "";
      const anchorName = req.body.anchor_name || req.body.anchorName || "";
      const announcement = req.body.announcement || "";
      const sortOrder = parseInt(req.body.sort_order || req.body.sortOrder || 0, 10) || 0;
      if (!["football", "basketball", "analysis"].includes(category)) return res.status(400).json({ ok: false, error: "无效的分类" });
      if (!["live", "offline", "pending"].includes(status)) return res.status(400).json({ ok: false, error: "无效的状态" });

      conn = await pool.getConnection();
      await conn.beginTransaction();
      const [roomResult] = await conn.query("INSERT INTO rooms (title, category, status, cover, anchor_name, announcement, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", [title, category, status, cover, anchorName, announcement, sortOrder]);
      const roomId = roomResult.insertId;
      const streamName = "room" + roomId;
      const template = await getTemplate(pool);
      const profile = {
        provider: process.env.LIVE_PROVIDER || "manual",
        pushDomain: "",
        pullDomain: "",
        appName: process.env.LIVE_APP_NAME || "live",
        streamName,
        obsServer: applyTpl(template.obsServerTemplate, roomId, streamName),
        obsStreamKey: applyTpl(template.obsKeyTemplate || 'room{id}', roomId, streamName),
        pullHlsUrl: applyTpl(template.hlsUrlTemplate, roomId, streamName),
        pullFlvUrl: applyTpl(template.flvUrlTemplate, roomId, streamName),
        remark: "系统随房间自动生成"
      };
      const password = randomPassword();
      const passwordHash = await bcrypt.hash(password, 10);
      const username = "anchor_room_" + roomId;
      const displayName = anchorName || title || ("房间" + roomId + "主播");
      const [anchorResult] = await conn.query("INSERT INTO anchors (room_id, username, password_hash, display_name, status) VALUES (?, ?, ?, ?, 'active')", [roomId, username, passwordHash, displayName]);
      await conn.query("INSERT INTO room_stream_profiles (room_id, provider, push_domain, pull_domain, app_name, stream_name, obs_server, obs_stream_key, pull_hls_url, pull_flv_url, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [roomId, profile.provider, profile.pushDomain, profile.pullDomain, profile.appName, profile.streamName, profile.obsServer, profile.obsStreamKey, profile.pullHlsUrl, profile.pullFlvUrl, profile.remark]);
      const playbackStreams = [];
      const hls = await insertStream(conn, roomId, profile, 'hls', profile.pullHlsUrl, 1, 1, '主线路 HLS');
      const flv = await insertStream(conn, roomId, profile, 'flv', profile.pullFlvUrl, hls ? 0 : 1, 2, '极速线路 FLV');
      if (hls) playbackStreams.push(hls);
      if (flv) playbackStreams.push(flv);
      await conn.commit();
      res.json({ ok: true, room: { id: roomId, title, category, status, cover, anchorName, announcement, sortOrder }, anchor: { id: anchorResult.insertId, roomId, username, password, displayName, status: 'active' }, streamProfile: profile, playbackStreams });
    } catch (err) {
      if (conn) { try { await conn.rollback(); } catch (e) {} }
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  return router;
};
