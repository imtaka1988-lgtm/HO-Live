const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const anchorAuthMiddleware = require("../middleware/anchorAuth");

function cleanText(value, maxLength) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
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
  return `room${roomId}`;
}

function normalizeCover(value) {
  const cover = cleanText(value, 500);
  if (!cover) return "";
  if (cover.startsWith("/uploads/") || cover.startsWith("/assets/")) return cover;
  try {
    const url = new URL(cover);
    return url.protocol === "https:" ? url.toString() : "";
  } catch (_) {
    return "";
  }
}

async function ensureRoomProfile(pool, roomId) {
  const streamName = defaultStreamName(roomId);
  await pool.query(
    "INSERT IGNORE INTO room_stream_profiles (room_id, stream_name) VALUES (?, ?)",
    [roomId, streamName]
  );
  const [rows] = await pool.query(
    "SELECT room_id AS roomId, provider, push_domain AS pushDomain, pull_domain AS pullDomain, app_name AS appName, stream_name AS streamName, obs_server AS obsServer, obs_stream_key AS obsStreamKey, pull_hls_url AS pullHlsUrl, pull_flv_url AS pullFlvUrl, remark FROM room_stream_profiles WHERE room_id = ? LIMIT 1",
    [roomId]
  );
  return rows[0] || null;
}

async function getRoom(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, title, category, status, cover, anchor_name AS anchorName, sort_order AS sortOrder, COALESCE(announcement, '') AS announcement FROM rooms WHERE id = ? LIMIT 1",
    [roomId]
  );
  return cleanRoom(rows[0]);
}

async function getPlaybackStreams(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT id, name, type, url, is_default, enabled, priority FROM room_streams WHERE room_id = ? ORDER BY priority, id",
    [roomId]
  );
  return rows.map(stream => ({
    id: stream.id,
    name: stream.name || "",
    type: stream.type || "hls",
    url: stream.url || "",
    enabled: Number(stream.enabled) === 1,
    default: Number(stream.is_default) === 1,
    priority: stream.priority || 99
  }));
}

module.exports = function (pool) {
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET;

  router.post("/login", async (req, res) => {
    try {
      const username = cleanText(req.body && req.body.username, 64).toLowerCase();
      const password = String((req.body && req.body.password) || "");
      if (!username || !password) {
        return res.status(400).json({ ok: false, error: "请输入主播账号和密码" });
      }

      const [rows] = await pool.query(
        "SELECT id, room_id AS roomId, username, password_hash AS passwordHash, display_name AS displayName, status FROM anchors WHERE LOWER(username) = ? LIMIT 1",
        [username]
      );
      if (!rows.length) return res.status(401).json({ ok: false, error: "主播账号或密码错误" });

      const anchor = rows[0];
      const valid = await bcrypt.compare(password, anchor.passwordHash);
      if (!valid) return res.status(401).json({ ok: false, error: "主播账号或密码错误" });
      if (anchor.status !== "active") return res.status(403).json({ ok: false, error: "主播账号已停用" });

      const token = jwt.sign(
        { type: "anchor", id: anchor.id, username: anchor.username, roomId: anchor.roomId },
        JWT_SECRET,
        { algorithm: "HS256", expiresIn: "24h" }
      );
      return res.json({
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
      console.error("[anchor login]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.get("/me", anchorAuthMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id, room_id AS roomId, username, display_name AS displayName, status FROM anchors WHERE id = ? LIMIT 1",
        [req.anchor.id]
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: "主播账号不存在" });
      if (rows[0].status !== "active") return res.status(403).json({ ok: false, error: "主播账号已停用" });
      return res.json({ ok: true, anchor: rows[0], room: await getRoom(pool, rows[0].roomId) });
    } catch (err) {
      console.error("[anchor me]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.get("/room", anchorAuthMiddleware, async (req, res) => {
    try {
      const room = await getRoom(pool, req.anchor.roomId);
      if (!room) return res.status(404).json({ ok: false, error: "绑定房间不存在" });
      return res.json({ ok: true, room });
    } catch (err) {
      console.error("[anchor room get]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.put("/room", anchorAuthMiddleware, async (req, res) => {
    try {
      const data = { ...(req.body || {}) };
      if (data.anchorName !== undefined && data.anchor_name === undefined) data.anchor_name = data.anchorName;
      const update = {};
      if (data.title !== undefined) update.title = cleanText(data.title, 200);
      if (data.cover !== undefined) {
        update.cover = normalizeCover(data.cover);
        if (data.cover && !update.cover) return res.status(400).json({ ok: false, error: "封面地址不正确" });
      }
      if (data.anchor_name !== undefined) update.anchor_name = cleanText(data.anchor_name, 100);
      if (data.announcement !== undefined) update.announcement = cleanText(data.announcement, 1000);
      if (Object.keys(update).length === 0) return res.status(400).json({ ok: false, error: "没有要更新的字段" });

      const setSql = Object.keys(update).map(key => `${key} = ?`).join(", ");
      const values = [...Object.values(update), req.anchor.roomId];
      const [result] = await pool.query(`UPDATE rooms SET ${setSql} WHERE id = ?`, values);
      if (result.affectedRows === 0) return res.status(404).json({ ok: false, error: "绑定房间不存在" });
      return res.json({
        ok: true,
        updated: result.affectedRows,
        fields: Object.keys(update),
        room: await getRoom(pool, req.anchor.roomId)
      });
    } catch (err) {
      console.error("[anchor room update]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.get("/stream-info", anchorAuthMiddleware, async (req, res) => {
    try {
      const room = await getRoom(pool, req.anchor.roomId);
      if (!room) return res.status(404).json({ ok: false, error: "绑定房间不存在" });
      const [profile, playbackStreams] = await Promise.all([
        ensureRoomProfile(pool, req.anchor.roomId),
        getPlaybackStreams(pool, req.anchor.roomId)
      ]);
      return res.json({
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
      console.error("[anchor stream info]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
