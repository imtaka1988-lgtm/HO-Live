const express = require("express");
const userAuthMiddleware = require("../middleware/userAuth");

let followsTableReady = false;
let expLogTableReady = false;
const FOLLOW_EXP_REWARD = 3;
const DAILY_LOGIN_EXP_REWARD = 5;

async function ensureFollowsTable(pool) {
  if (followsTableReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS user_follows (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, room_id INT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_user_room (user_id, room_id), KEY idx_user_id (user_id), KEY idx_room_id (room_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  followsTableReady = true;
}

async function ensureExpLogTable(pool) {
  if (expLogTableReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS user_exp_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, action VARCHAR(64) NOT NULL, ref_id VARCHAR(64) NOT NULL DEFAULT '', exp INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_user_action_ref (user_id, action, ref_id), KEY idx_user_id (user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  expLogTableReady = true;
}

function levelFromExp(exp) {
  const n = Number(exp || 0);
  if (n >= 600) return 5;
  if (n >= 300) return 4;
  if (n >= 150) return 3;
  if (n >= 50) return 2;
  return 1;
}

async function addUserExp(pool, userId, amount) {
  const [rows] = await pool.query("SELECT coins, level FROM users WHERE id = ?", [userId]);
  if (!rows.length) return null;
  const exp = Number(rows[0].coins || 0) + amount;
  const level = Math.max(Number(rows[0].level || 1), levelFromExp(exp));
  await pool.query("UPDATE users SET coins = ?, level = ? WHERE id = ?", [exp, level, userId]);
  return { exp, level, added: amount };
}

async function awardUserExpOnce(pool, userId, action, refId, amount) {
  await ensureExpLogTable(pool);
  const [log] = await pool.query(
    "INSERT IGNORE INTO user_exp_logs (user_id, action, ref_id, exp) VALUES (?, ?, ?, ?)",
    [userId, action, String(refId || ''), amount]
  );
  if (log.affectedRows === 0) return null;
  return addUserExp(pool, userId, amount);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
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

      let dailyReward = null;
      try {
        dailyReward = await awardUserExpOnce(pool, u.id, "daily_login", todayKey(), DAILY_LOGIN_EXP_REWARD);
      } catch (e) {}

      const exp = dailyReward ? Number(dailyReward.exp || 0) : Number(u.coins || 0);
      const level = dailyReward ? Number(dailyReward.level || 1) : Math.max(Number(u.level || 1), levelFromExp(exp));

      res.json({
        ok: true,
        user: {
          id: u.id,
          phone: u.phone,
          nickname: u.nickname || "",
          avatar: u.avatar || "",
          level,
          coins: exp,
          exp,
          followCount,
          status: u.status,
          createdAt: u.created_at
        },
        dailyReward
      });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
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
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
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
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.post("/follows/rooms/:roomId", userAuthMiddleware, async (req, res) => {
    try {
      await ensureFollowsTable(pool);
      const roomId = parseInt(req.params.roomId, 10);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const [rooms] = await pool.query("SELECT id FROM rooms WHERE id = ?", [roomId]);
      if (!rooms.length) return res.status(404).json({ ok: false, error: "房间不存在" });
      const [result] = await pool.query("INSERT IGNORE INTO user_follows (user_id, room_id) VALUES (?, ?)", [req.user.id, roomId]);
      const reward = result.affectedRows > 0 ? await awardUserExpOnce(pool, req.user.id, "follow_room", roomId, FOLLOW_EXP_REWARD) : null;
      res.json({ ok: true, followed: true, reward });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
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
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
