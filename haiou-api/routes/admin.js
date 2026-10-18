const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../middleware/auth");
const { fetchOddsRecommendations } = require("../services/odds");

const ROOM_CATEGORIES = new Set(["football", "basketball", "analysis"]);
const ROOM_STATUSES = new Set(["live", "offline", "pending"]);
const STREAM_TYPES = new Set(["hls", "flv"]);

function text(value, maxLength) {
  return String(value == null ? "" : value).trim().slice(0, maxLength);
}

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function parsePriority(value, fallback = 99) {
  const priority = Number.parseInt(value, 10);
  if (!Number.isFinite(priority)) return fallback;
  return Math.max(0, Math.min(priority, 9999));
}

function normalizeStreamUrl(value) {
  const raw = text(value, 2000);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!new Set(["http:", "https:"]).has(parsed.protocol)) return "";
    return parsed.toString();
  } catch (_) {
    return "";
  }
}

module.exports = function (pool) {
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET;

  router.post("/login", async (req, res) => {
    try {
      const username = text(req.body && req.body.username, 80).toLowerCase();
      const password = String((req.body && req.body.password) || "");
      if (!username || !password) {
        return res.status(400).json({ ok: false, error: "请输入用户名和密码" });
      }

      const [rows] = await pool.query(
        "SELECT id, username, password_hash FROM admins WHERE LOWER(username) = ? LIMIT 1",
        [username]
      );
      if (rows.length === 0) {
        return res.status(401).json({ ok: false, error: "用户名或密码错误" });
      }

      const admin = rows[0];
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) {
        return res.status(401).json({ ok: false, error: "用户名或密码错误" });
      }

      const token = jwt.sign(
        { id: admin.id, username: admin.username, type: "admin" },
        JWT_SECRET,
        { algorithm: "HS256", expiresIn: "24h" }
      );
      return res.json({ ok: true, token });
    } catch (err) {
      console.error("[admin login]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.get("/me", authMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id, username, created_at FROM admins WHERE id = ? LIMIT 1",
        [req.admin.id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ ok: false, error: "管理员不存在" });
      }
      return res.json({ ok: true, admin: { username: rows[0].username } });
    } catch (err) {
      console.error("[admin me]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.put("/rooms/:id", authMiddleware, async (req, res) => {
    try {
      const roomId = parseId(req.params.id);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });

      const allowed = ["title", "category", "status", "cover", "anchor_name", "announcement", "sort_order"];
      const updates = {};
      for (const field of allowed) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ ok: false, error: "没有要更新的字段" });
      }

      if (updates.title !== undefined) updates.title = text(updates.title, 200);
      if (updates.cover !== undefined) updates.cover = text(updates.cover, 500);
      if (updates.anchor_name !== undefined) updates.anchor_name = text(updates.anchor_name, 100);
      if (updates.announcement !== undefined) updates.announcement = text(updates.announcement, 1000);
      if (updates.sort_order !== undefined) updates.sort_order = parsePriority(updates.sort_order, 0);

      if (updates.category && !ROOM_CATEGORIES.has(updates.category)) {
        return res.status(400).json({ ok: false, error: "无效的分类" });
      }
      if (updates.status && !ROOM_STATUSES.has(updates.status)) {
        return res.status(400).json({ ok: false, error: "无效的状态" });
      }

      const setSql = Object.keys(updates).map(field => `${field} = ?`).join(", ");
      const values = [...Object.values(updates), roomId];
      const [result] = await pool.query(`UPDATE rooms SET ${setSql} WHERE id = ?`, values);
      if (result.affectedRows === 0) {
        return res.status(404).json({ ok: false, error: "房间不存在" });
      }
      return res.json({ ok: true, updated: result.affectedRows, fields: Object.keys(updates) });
    } catch (err) {
      console.error("[admin update room]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.post("/rooms/:roomId/streams", authMiddleware, async (req, res) => {
    const roomId = parseId(req.params.roomId);
    if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });

    const name = text(req.body && req.body.name, 100);
    const type = text(req.body && req.body.type, 20).toLowerCase();
    const url = normalizeStreamUrl(req.body && req.body.url);
    if (!name || !type || !url) {
      return res.status(400).json({ ok: false, error: "线路名称、播放类型和有效播放地址必填" });
    }
    if (!STREAM_TYPES.has(type)) {
      return res.status(400).json({ ok: false, error: "type 只能是 hls 或 flv" });
    }

    const enabled = req.body.enabled === undefined ? 1 : (Number(req.body.enabled) ? 1 : 0);
    const isDefault = Number(req.body.is_default || req.body.isDefault || 0) ? 1 : 0;
    const priority = parsePriority(req.body.priority, 99);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [rooms] = await connection.query("SELECT id FROM rooms WHERE id = ? FOR UPDATE", [roomId]);
      if (rooms.length === 0) {
        await connection.rollback();
        return res.status(404).json({ ok: false, error: "房间不存在" });
      }
      if (isDefault === 1) {
        await connection.query("UPDATE room_streams SET is_default = 0 WHERE room_id = ?", [roomId]);
      }
      const [result] = await connection.query(
        "INSERT INTO room_streams (room_id, name, type, url, is_default, enabled, priority) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [roomId, name, type, url, isDefault, enabled, priority]
      );
      await connection.commit();
      return res.json({
        ok: true,
        stream: {
          id: result.insertId,
          room_id: roomId,
          name,
          type,
          url,
          is_default: isDefault,
          enabled,
          priority
        }
      });
    } catch (err) {
      try { await connection.rollback(); } catch (_) {}
      console.error("[admin create stream]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    } finally {
      connection.release();
    }
  });

  router.put("/rooms/:roomId/streams/:streamId", authMiddleware, async (req, res) => {
    const roomId = parseId(req.params.roomId);
    const streamId = parseId(req.params.streamId);
    if (!roomId || !streamId) return res.status(400).json({ ok: false, error: "无效的 ID" });

    const allowed = ["name", "type", "url", "is_default", "enabled", "priority", "provider", "mode", "app_name", "stream_name", "device_policy", "remark"];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ ok: false, error: "没有要更新的字段" });
    }

    if (updates.name !== undefined) updates.name = text(updates.name, 100);
    if (updates.type !== undefined) {
      updates.type = text(updates.type, 20).toLowerCase();
      if (!STREAM_TYPES.has(updates.type)) {
        return res.status(400).json({ ok: false, error: "type 只能是 hls 或 flv" });
      }
    }
    if (updates.url !== undefined) {
      updates.url = normalizeStreamUrl(updates.url);
      if (!updates.url) return res.status(400).json({ ok: false, error: "播放地址无效" });
    }
    if (updates.is_default !== undefined) updates.is_default = Number(updates.is_default) ? 1 : 0;
    if (updates.enabled !== undefined) updates.enabled = Number(updates.enabled) ? 1 : 0;
    if (updates.priority !== undefined) updates.priority = parsePriority(updates.priority, 99);
    for (const field of ["provider", "mode", "app_name", "stream_name", "device_policy", "remark"]) {
      if (updates[field] !== undefined) updates[field] = text(updates[field], field === "remark" ? 500 : 100);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [streams] = await connection.query(
        "SELECT id FROM room_streams WHERE id = ? AND room_id = ? FOR UPDATE",
        [streamId, roomId]
      );
      if (streams.length === 0) {
        await connection.rollback();
        return res.status(404).json({ ok: false, error: "播放源不存在或不属于该房间" });
      }
      if (updates.is_default === 1) {
        await connection.query("UPDATE room_streams SET is_default = 0 WHERE room_id = ?", [roomId]);
      }
      const setSql = Object.keys(updates).map(field => `${field} = ?`).join(", ");
      const values = [...Object.values(updates), streamId, roomId];
      const [result] = await connection.query(
        `UPDATE room_streams SET ${setSql} WHERE id = ? AND room_id = ?`,
        values
      );
      await connection.commit();
      return res.json({ ok: true, updated: result.affectedRows, fields: Object.keys(updates) });
    } catch (err) {
      try { await connection.rollback(); } catch (_) {}
      console.error("[admin update stream]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    } finally {
      connection.release();
    }
  });

  router.delete("/rooms/:roomId/streams/:streamId", authMiddleware, async (req, res) => {
    try {
      const roomId = parseId(req.params.roomId);
      const streamId = parseId(req.params.streamId);
      if (!roomId || !streamId) return res.status(400).json({ ok: false, error: "无效的 ID" });

      const [result] = await pool.query(
        "DELETE FROM room_streams WHERE id = ? AND room_id = ?",
        [streamId, roomId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ ok: false, error: "播放源不存在或不属于该房间" });
      }
      return res.json({ ok: true, deleted: result.affectedRows });
    } catch (err) {
      console.error("[admin delete stream]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.get("/odds/recommendations", authMiddleware, async (req, res) => {
    try {
      const data = await fetchOddsRecommendations();
      if (!data) return res.status(503).json({ ok: false, error: "ODDS_API_KEY not configured" });
      return res.json(data);
    } catch (err) {
      console.error("[admin odds]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
