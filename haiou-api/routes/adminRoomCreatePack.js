const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");

const ROOM_CATEGORIES = new Set(["football", "basketball", "analysis"]);
const ROOM_STATUSES = new Set(["live", "offline", "pending"]);

function clean(value, maxLength, fallback = "") {
  const result = String(value == null ? "" : value).trim().slice(0, maxLength);
  return result || fallback;
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let output = "";
  for (let index = 0; index < 12; index += 1) output += chars[crypto.randomInt(chars.length)];
  return output;
}

function pickSmallestMissingRoomId(rows) {
  let nextId = 1;
  for (const row of rows) {
    const id = Number(row.id);
    if (id === nextId) nextId += 1;
    else if (id > nextId) break;
  }
  return nextId;
}

function applyTemplate(value, roomId, streamName) {
  return String(value || "")
    .replace(/\{id\}/g, String(roomId))
    .replace(/\{roomId\}/g, String(roomId))
    .replace(/\{streamName\}/g, streamName);
}

async function getTemplate(pool) {
  const [rows] = await pool.query(
    "SELECT obs_server_template AS obsServerTemplate, obs_key_template AS obsKeyTemplate, hls_url_template AS hlsUrlTemplate, flv_url_template AS flvUrlTemplate FROM obs_template WHERE id = 1 LIMIT 1"
  );
  return rows[0] || { obsServerTemplate: "", obsKeyTemplate: "room{id}", hlsUrlTemplate: "", flvUrlTemplate: "" };
}

async function insertStream(connection, roomId, profile, type, url, isDefault, priority, name) {
  if (!url) return null;
  const [result] = await connection.query(
    "INSERT INTO room_streams (room_id, name, type, url, is_default, enabled, priority, provider, mode, app_name, stream_name, device_policy, remark) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'room_fixed', ?, ?, 'auto', '系统随房间自动生成')",
    [roomId, name, type, url, isDefault, priority, profile.provider, profile.appName, profile.streamName]
  );
  return { id: result.insertId, type, url };
}

module.exports = function (pool) {
  const router = express.Router();

  router.post("/rooms", authMiddleware, async (req, res) => {
    let connection = null;
    try {
      const body = req.body || {};
      const title = clean(body.title, 200, "新直播间");
      const category = clean(body.category, 30, "football");
      const status = clean(body.status, 30, "offline");
      const cover = clean(body.cover, 500);
      const anchorName = clean(body.anchor_name ?? body.anchorName, 100);
      const announcement = clean(body.announcement, 1000);
      const sortOrder = Math.max(0, Math.min(Number.parseInt(body.sort_order ?? body.sortOrder ?? 0, 10) || 0, 9999));

      if (!ROOM_CATEGORIES.has(category)) return res.status(400).json({ ok: false, error: "无效的分类" });
      if (!ROOM_STATUSES.has(status)) return res.status(400).json({ ok: false, error: "无效的状态" });

      const template = await getTemplate(pool);
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [ids] = await connection.query("SELECT id FROM rooms ORDER BY id ASC FOR UPDATE");
      const roomId = pickSmallestMissingRoomId(ids);
      await connection.query(
        "INSERT INTO rooms (id, title, category, status, cover, anchor_name, announcement, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [roomId, title, category, status, cover, anchorName, announcement, sortOrder]
      );

      const streamName = `room${roomId}`;
      const profile = {
        provider: clean(process.env.LIVE_PROVIDER, 32, "manual"),
        pushDomain: "",
        pullDomain: "",
        appName: clean(process.env.LIVE_APP_NAME, 64, "live"),
        streamName,
        obsServer: applyTemplate(template.obsServerTemplate, roomId, streamName).slice(0, 255),
        obsStreamKey: applyTemplate(template.obsKeyTemplate || "room{id}", roomId, streamName).slice(0, 255),
        pullHlsUrl: applyTemplate(template.hlsUrlTemplate, roomId, streamName).slice(0, 500),
        pullFlvUrl: applyTemplate(template.flvUrlTemplate, roomId, streamName).slice(0, 500),
        remark: "系统随房间自动生成"
      };

      const password = randomPassword();
      const passwordHash = await bcrypt.hash(password, 10);
      const username = `anchor_room_${roomId}`;
      const displayName = anchorName || title || `房间${roomId}主播`;
      const [anchorResult] = await connection.query(
        "INSERT INTO anchors (room_id, username, password_hash, display_name, status) VALUES (?, ?, ?, ?, 'active')",
        [roomId, username, passwordHash, displayName]
      );
      await connection.query(
        "INSERT INTO room_stream_profiles (room_id, provider, push_domain, pull_domain, app_name, stream_name, obs_server, obs_stream_key, pull_hls_url, pull_flv_url, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [roomId, profile.provider, profile.pushDomain, profile.pullDomain, profile.appName, profile.streamName, profile.obsServer, profile.obsStreamKey, profile.pullHlsUrl, profile.pullFlvUrl, profile.remark]
      );

      const playbackStreams = [];
      const hls = await insertStream(connection, roomId, profile, "hls", profile.pullHlsUrl, 1, 1, "主线路 HLS");
      const flv = await insertStream(connection, roomId, profile, "flv", profile.pullFlvUrl, hls ? 0 : 1, 2, "极速线路 FLV");
      if (hls) playbackStreams.push(hls);
      if (flv) playbackStreams.push(flv);

      await connection.commit();
      return res.status(201).json({
        ok: true,
        room: { id: roomId, title, category, status, cover, anchorName, announcement, sortOrder },
        anchor: { id: anchorResult.insertId, roomId, username, password, displayName, status: "active" },
        streamProfile: profile,
        playbackStreams
      });
    } catch (err) {
      if (connection) {
        try { await connection.rollback(); } catch (_) {}
      }
      console.error("[admin create room pack]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    } finally {
      if (connection) connection.release();
    }
  });

  return router;
};
