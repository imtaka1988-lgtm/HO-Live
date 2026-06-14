const express = require("express");
const userAuthMiddleware = require("../middleware/userAuth");

let followsTableReady = false;

async function ensureFollowsTable(pool) {
  if (followsTableReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS user_follows (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, room_id INT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_user_room (user_id, room_id), KEY idx_user_id (user_id), KEY idx_room_id (room_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  followsTableReady = true;
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/me", userAuthMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id, phone, nickname, avatar, level, coins, status, created_at FROM users WHERE id = ?",
        [req.user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ ok: false, error: "用户不存在" });
      }

      const u = rows[0];
      if (u.status !== "active") {
        return res.status(403).json({ ok: false, error: "账号已被限制" });
      }

      let followCount = 0;
      try {
        await ensureFollowsTable(pool);
        const [countRows] = await pool.query("SELECT COUNT(*) AS cnt FROM user_follows WHERE user_id = ?", [u.id]);
        followCount = Number(countRows[0].cnt || 0);
      } catch (e) {}

      res.json({
        ok: true,
        user: {
          id: u.id,
          phone: u.phone,
          nickname: u.nickname || "",
          avatar: u.avatar || "",
          level: u.level || 0,
          coins: u.coins || 0,
          followCount,
          status: u.status,
          createdAt: u.created_at
        }
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get("/follows", userAuthMiddleware, async (req, res) => {
    try {
      await ensureFollowsTable(pool);
      const [rooms] = await pool.query(
        "SELECT r.id, r.title, r.category, r.status, r.cover, r.anchor_name AS anchorName, r.sort_order AS sortOrder, f.created_at AS followedAt FROM user_follows f JOIN rooms r ON r.id = f.room_id WHERE f.user_id = ? ORDER BY f.created_at DESC",
        [req.user.id]
      );
      res.json({ ok: true, count: rooms.length, rooms });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get("/follows/rooms/:roomId", userAuthMiddleware, async (req, res) => {
    try {
      await ensureFollowsTable(pool);
      const roomId = parseInt(req.params.roomId, 10);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const [rows] = await pool.query("SELECT id FROM user_follows WHERE user_id = ? AND room_id = ?", [req.user.id, roomId]);
      res.json({ ok: true, followed: rows.length > 0 });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post("/follows/rooms/:roomId", userAuthMiddleware, async (req, res) => {
    try {
      await ensureFollowsTable(pool);
      const roomId = parseInt(req.params.roomId, 10);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const [rooms] = await pool.query("SELECT id FROM rooms WHERE id = ?", [roomId]);
      if (!rooms.length) return res.status(404).json({ ok: false, error: "房间不存在" });
      await pool.query("INSERT IGNORE INTO user_follows (user_id, room_id) VALUES (?, ?)", [req.user.id, roomId]);
      res.json({ ok: true, followed: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.delete("/follows/rooms/:roomId", userAuthMiddleware, async (req, res) => {
    try {
      await ensureFollowsTable(pool);
      const roomId = parseInt(req.params.roomId, 10);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      await pool.query("DELETE FROM user_follows WHERE user_id = ? AND room_id = ?", [req.user.id, roomId]);
      res.json({ ok: true, followed: false });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
