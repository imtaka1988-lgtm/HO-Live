const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function clean(value, maxLength, fallback = "") {
  const result = String(value == null ? "" : value).trim().slice(0, maxLength);
  return result || fallback;
}

function randomPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let output = "";
  for (let index = 0; index < length; index += 1) output += chars[crypto.randomInt(chars.length)];
  return output;
}

function cleanDomain(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^rtmp:\/\//i, "")
    .replace(/\/+$/, "")
    .slice(0, 128);
}

function buildDefaultProfile(roomId) {
  const appName = clean(process.env.LIVE_APP_NAME, 64, "live");
  const streamName = `room${roomId}`;
  const pushDomain = cleanDomain(process.env.LIVE_PUSH_DOMAIN || "");
  const pullDomain = cleanDomain(process.env.LIVE_PULL_DOMAIN || "");
  const pushProtocol = clean(process.env.LIVE_PUSH_PROTOCOL, 10, "rtmp").replace(":", "");
  return {
    provider: clean(process.env.LIVE_PROVIDER, 32, "manual"),
    pushDomain,
    pullDomain,
    appName,
    streamName,
    obsServer: pushDomain ? `${pushProtocol}://${pushDomain}/${appName}` : "",
    obsStreamKey: streamName,
    pullHlsUrl: pullDomain ? `https://${pullDomain}/${appName}/${streamName}.m3u8` : "",
    pullFlvUrl: pullDomain ? `https://${pullDomain}/${appName}/${streamName}.flv` : "",
    remark: "系统随房间自动生成"
  };
}

async function getRoom(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, title, category, status, cover, anchor_name AS anchorName, COALESCE(announcement, '') AS announcement FROM rooms WHERE id = ? LIMIT 1",
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
    "SELECT room_id AS roomId, provider, push_domain AS pushDomain, pull_domain AS pullDomain, app_name AS appName, stream_name AS streamName, obs_server AS obsServer, obs_stream_key AS obsStreamKey, pull_hls_url AS pullHlsUrl, pull_flv_url AS pullFlvUrl, remark FROM room_stream_profiles WHERE room_id = ? LIMIT 1",
    [roomId]
  );
  return rows[0] || defaults;
}

async function getAnchor(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, room_id AS roomId, username, display_name AS displayName, status, created_at AS createdAt, updated_at AS updatedAt FROM anchors WHERE room_id = ? LIMIT 1",
    [roomId]
  );
  return rows[0] || null;
}

async function getStreams(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, name, type, url, is_default, enabled, priority FROM room_streams WHERE room_id = ? ORDER BY priority, id",
    [roomId]
  );
  return rows.map(stream => ({
    id: stream.id,
    name: stream.name,
    type: stream.type,
    url: stream.url,
    default: Number(stream.is_default) === 1,
    enabled: Number(stream.enabled) === 1,
    priority: stream.priority
  }));
}

async function buildBundle(pool, roomId) {
  const room = await getRoom(pool, roomId);
  if (!room) return null;
  const [anchor, streamProfile, playbackStreams] = await Promise.all([
    getAnchor(pool, roomId),
    ensureProfile(pool, roomId),
    getStreams(pool, roomId)
  ]);
  return { room, anchor, streamProfile, playbackStreams };
}

async function createAnchor(pool, room) {
  const existing = await getAnchor(pool, room.id);
  if (existing) return { anchor: existing, password: "", created: false };

  const username = `anchor_room_${room.id}`;
  const password = randomPassword();
  const hash = await bcrypt.hash(password, 10);
  const displayName = clean(room.anchorName || room.title, 100, `房间${room.id}主播`);
  try {
    const [result] = await pool.query(
      "INSERT INTO anchors (room_id, username, password_hash, display_name, status) VALUES (?, ?, ?, ?, 'active')",
      [room.id, username, hash, displayName]
    );
    return {
      anchor: { id: result.insertId, roomId: room.id, username, displayName, status: "active" },
      password,
      created: true
    };
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return { anchor: await getAnchor(pool, room.id), password: "", created: false };
    }
    throw err;
  }
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/rooms/:roomId/anchor-bundle", authMiddleware, async (req, res) => {
    try {
      const roomId = parseId(req.params.roomId);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const bundle = await buildBundle(pool, roomId);
      if (!bundle) return res.status(404).json({ ok: false, error: "房间不存在" });
      return res.json({ ok: true, ...bundle });
    } catch (err) {
      console.error("[admin anchor bundle get]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.post("/rooms/:roomId/anchor-bundle", authMiddleware, async (req, res) => {
    try {
      const roomId = parseId(req.params.roomId);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const room = await getRoom(pool, roomId);
      if (!room) return res.status(404).json({ ok: false, error: "房间不存在" });
      const created = await createAnchor(pool, room);
      const bundle = await buildBundle(pool, roomId);
      return res.json({ ok: true, ...bundle, generatedPassword: created.password, created: created.created });
    } catch (err) {
      console.error("[admin anchor bundle create]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.put("/rooms/:roomId/anchor-bundle/stream-profile", authMiddleware, async (req, res) => {
    try {
      const roomId = parseId(req.params.roomId);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      if (!(await getRoom(pool, roomId))) return res.status(404).json({ ok: false, error: "房间不存在" });
      await ensureProfile(pool, roomId);

      const body = req.body || {};
      const obsServer = clean(body.obsServer ?? body.obs_server, 255);
      const obsStreamKey = clean(body.obsStreamKey ?? body.obs_stream_key, 255);
      await pool.query(
        "UPDATE room_stream_profiles SET obs_server = ?, obs_stream_key = ? WHERE room_id = ?",
        [obsServer, obsStreamKey, roomId]
      );

      return res.json({ ok: true, ...(await buildBundle(pool, roomId)), saved: true });
    } catch (err) {
      console.error("[admin anchor bundle profile]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.post("/rooms/:roomId/anchor-bundle/reset-password", authMiddleware, async (req, res) => {
    try {
      const roomId = parseId(req.params.roomId);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const anchor = await getAnchor(pool, roomId);
      if (!anchor) return res.status(404).json({ ok: false, error: "该房间还没有主播账号" });

      const password = randomPassword();
      const hash = await bcrypt.hash(password, 10);
      await pool.query("UPDATE anchors SET password_hash = ? WHERE id = ?", [hash, anchor.id]);
      return res.json({ ok: true, ...(await buildBundle(pool, roomId)), generatedPassword: password, reset: true });
    } catch (err) {
      console.error("[admin anchor password reset]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
