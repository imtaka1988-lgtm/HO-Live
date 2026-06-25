const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const https = require("https");
const authMiddleware = require("../middleware/auth");
const { fetchOddsRecommendations } = require("../services/odds");

module.exports = function (pool) {
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET;

  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) return res.status(400).json({ ok: false, error: "请输入用户名和密码" });
      const [rows] = await pool.query("SELECT id, username, password_hash FROM admins WHERE username = ?", [username]);
      if (rows.length === 0) return res.status(401).json({ ok: false, error: "用户名或密码错误" });
      const admin = rows[0];
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) return res.status(401).json({ ok: false, error: "用户名或密码错误" });
      const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: "24h" });
      res.json({ ok: true, token });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.get("/me", authMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT id, username, created_at FROM admins WHERE id = ?", [req.admin.id]);
      if (rows.length === 0) return res.status(404).json({ ok: false, error: "管理员不存在" });
      res.json({ ok: true, admin: { username: rows[0].username } });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.put("/rooms/:id", authMiddleware, async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const allowed = ["title", "category", "status", "cover", "anchor_name", "announcement", "sort_order"];
      const u = {};
      for (const f of allowed) if (req.body[f] !== undefined) u[f] = req.body[f];
      if (Object.keys(u).length === 0) return res.status(400).json({ ok: false, error: "没有要更新的字段" });
      if (u.category && !["football", "basketball", "analysis"].includes(u.category))
        return res.status(400).json({ ok: false, error: "无效的分类" });
      if (u.status && !["live", "offline", "pending"].includes(u.status))
        return res.status(400).json({ ok: false, error: "无效的状态" });
      const set = Object.keys(u).map(k => k + " = ?").join(", ");
      const vals = Object.values(u);
      vals.push(roomId);
      const [r] = await pool.query("UPDATE rooms SET " + set + " WHERE id = ?", vals);
      if (r.affectedRows === 0) return res.status(404).json({ ok: false, error: "房间不存在" });
      res.json({ ok: true, updated: r.affectedRows, fields: Object.keys(u) });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.post("/rooms/:roomId/streams", authMiddleware, async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });

      const { name, type, url } = req.body || {};
      if (!name || !type || !url) {
        return res.status(400).json({ ok: false, error: "线路名称、播放类型、播放地址必填" });
      }

      if (!["hls", "flv"].includes(type)) {
        return res.status(400).json({ ok: false, error: "type 只能是 hls 或 flv" });
      }

      const [rooms] = await pool.query("SELECT id FROM rooms WHERE id = ?", [roomId]);
      if (rooms.length === 0) {
        return res.status(404).json({ ok: false, error: "房间不存在" });
      }

      const enabled = req.body.enabled === undefined ? 1 : (Number(req.body.enabled) ? 1 : 0);
      const isDefault = Number(req.body.is_default || req.body.isDefault || 0) ? 1 : 0;
      const priority = parseInt(req.body.priority) || 99;

      if (isDefault === 1) {
        await pool.query("UPDATE room_streams SET is_default = 0 WHERE room_id = ?", [roomId]);
      }

      const [r] = await pool.query(
        "INSERT INTO room_streams (room_id, name, type, url, is_default, enabled, priority) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [roomId, name, type, url, isDefault, enabled, priority]
      );

      res.json({
        ok: true,
        stream: {
          id: r.insertId,
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
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.put("/rooms/:roomId/streams/:streamId", authMiddleware, async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId), streamId = parseInt(req.params.streamId);
      if (!roomId || !streamId) return res.status(400).json({ ok: false, error: "无效的 ID" });
      const allowed = ["name", "type", "url", "is_default", "enabled", "priority", "provider", "mode", "app_name", "stream_name", "device_policy", "remark"];
      const u = {};
      for (const f of allowed) if (req.body[f] !== undefined) u[f] = req.body[f];
      if (Object.keys(u).length === 0) return res.status(400).json({ ok: false, error: "没有要更新的字段" });
      if (u.type && !["hls", "flv"].includes(u.type))
        return res.status(400).json({ ok: false, error: "type 只能是 hls 或 flv" });
      const [streams] = await pool.query("SELECT id FROM room_streams WHERE id = ? AND room_id = ?", [streamId, roomId]);
      if (streams.length === 0) return res.status(404).json({ ok: false, error: "播放源不存在或不属于该房间" });
      const set = Object.keys(u).map(k => k + " = ?").join(", ");
      const vals = Object.values(u);
      vals.push(streamId);
      const [r] = await pool.query("UPDATE room_streams SET " + set + " WHERE id = ?", vals);
      res.json({ ok: true, updated: r.affectedRows, fields: Object.keys(u) });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.delete("/rooms/:roomId/streams/:streamId", authMiddleware, async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const streamId = parseInt(req.params.streamId);

      if (!roomId || !streamId) {
        return res.status(400).json({ ok: false, error: "无效的 ID" });
      }

      const [streams] = await pool.query(
        "SELECT id FROM room_streams WHERE id = ? AND room_id = ?",
        [streamId, roomId]
      );

      if (streams.length === 0) {
        return res.status(404).json({ ok: false, error: "播放源不存在或不属于该房间" });
      }

      const [r] = await pool.query(
        "DELETE FROM room_streams WHERE id = ? AND room_id = ?",
        [streamId, roomId]
      );

      res.json({ ok: true, deleted: r.affectedRows });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  // odds 路由在 adminOddsTimeout.js（先加载，避免冲突）
  router.get("/odds/recommendations", authMiddleware, async (req, res) => {
    try {
      const data = await fetchOddsRecommendations();
      if (!data) return res.status(500).json({ ok: false, error: "ODDS_API_KEY not configured" });
      res.json(data);
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
