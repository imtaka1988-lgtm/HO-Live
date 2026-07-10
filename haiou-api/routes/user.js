const express = require("express");
const userAuthMiddleware = require("../middleware/userAuth");

const FOLLOW_EXP_REWARD = 3;
const DAILY_LOGIN_EXP_REWARD = 5;

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function beijingDayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function levelFromExp(exp) {
  const value = Number(exp || 0);
  if (value >= 600) return 5;
  if (value >= 300) return 4;
  if (value >= 150) return 3;
  if (value >= 50) return 2;
  return 1;
}

async function addUserExp(pool, userId, amount) {
  const [updated] = await pool.query("UPDATE users SET coins = coins + ? WHERE id = ?", [amount, userId]);
  if (updated.affectedRows === 0) return null;

  const [rows] = await pool.query("SELECT coins, level FROM users WHERE id = ? LIMIT 1", [userId]);
  if (!rows.length) return null;
  const exp = Number(rows[0].coins || 0);
  const currentLevel = Number(rows[0].level || 1);
  const level = Math.max(currentLevel, levelFromExp(exp));
  if (level !== currentLevel) await pool.query("UPDATE users SET level = ? WHERE id = ?", [level, userId]);
  return { exp, level, added: amount };
}

async function awardUserExpOnce(pool, userId, action, refId, amount) {
  const [log] = await pool.query(
    "INSERT IGNORE INTO user_exp_logs (user_id, action, ref_id, exp) VALUES (?, ?, ?, ?)",
    [userId, action, String(refId || ""), amount]
  );
  if (log.affectedRows === 0) return null;
  return addUserExp(pool, userId, amount);
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/me", userAuthMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id, phone, nickname, avatar, level, coins, status, created_at FROM users WHERE id = ? LIMIT 1",
        [req.user.id]
      );
      if (rows.length === 0) return res.status(404).json({ ok: false, error: "用户不存在" });

      const user = rows[0];
      if (user.status !== "active") return res.status(403).json({ ok: false, error: "账号已被限制" });

      const [countRows] = await pool.query("SELECT COUNT(*) AS cnt FROM user_follows WHERE user_id = ?", [user.id]);
      const followCount = Number(countRows[0].cnt || 0);
      let dailyReward = null;
      try {
        dailyReward = await awardUserExpOnce(pool, user.id, "daily_login", beijingDayKey(), DAILY_LOGIN_EXP_REWARD);
      } catch (err) {
        console.error("[user daily reward]", err);
      }

      const exp = dailyReward ? Number(dailyReward.exp || 0) : Number(user.coins || 0);
      const level = dailyReward ? Number(dailyReward.level || 1) : Math.max(Number(user.level || 1), levelFromExp(exp));
      return res.json({
        ok: true,
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname || "",
          avatar: user.avatar || "",
          level,
          coins: exp,
          exp,
          followCount,
          status: user.status,
          createdAt: user.created_at
        },
        dailyReward
      });
    } catch (err) {
      console.error("[user profile]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.get("/follows", userAuthMiddleware, async (req, res) => {
    try {
      const [rooms] = await pool.query(
        "SELECT r.id, r.title, r.category, r.status, r.cover, r.anchor_name AS anchorName, r.sort_order AS sortOrder, f.created_at AS followedAt FROM user_follows f JOIN rooms r ON r.id = f.room_id WHERE f.user_id = ? ORDER BY f.created_at DESC",
        [req.user.id]
      );
      res.setHeader("Cache-Control", "private, max-age=10");
      return res.json({ ok: true, count: rooms.length, rooms });
    } catch (err) {
      console.error("[user follows list]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.get("/follows/rooms/:roomId", userAuthMiddleware, async (req, res) => {
    try {
      const roomId = parseId(req.params.roomId);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const [rows] = await pool.query(
        "SELECT id FROM user_follows WHERE user_id = ? AND room_id = ? LIMIT 1",
        [req.user.id, roomId]
      );
      return res.json({ ok: true, followed: rows.length > 0 });
    } catch (err) {
      console.error("[user follow status]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.post("/follows/rooms/:roomId", userAuthMiddleware, async (req, res) => {
    try {
      const roomId = parseId(req.params.roomId);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const [rooms] = await pool.query("SELECT id FROM rooms WHERE id = ? LIMIT 1", [roomId]);
      if (!rooms.length) return res.status(404).json({ ok: false, error: "房间不存在" });

      const [result] = await pool.query(
        "INSERT IGNORE INTO user_follows (user_id, room_id) VALUES (?, ?)",
        [req.user.id, roomId]
      );
      const reward = result.affectedRows > 0
        ? await awardUserExpOnce(pool, req.user.id, "follow_room", roomId, FOLLOW_EXP_REWARD)
        : null;
      return res.json({ ok: true, followed: true, created: result.affectedRows > 0, reward });
    } catch (err) {
      console.error("[user follow create]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.delete("/follows/rooms/:roomId", userAuthMiddleware, async (req, res) => {
    try {
      const roomId = parseId(req.params.roomId);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });
      const [result] = await pool.query(
        "DELETE FROM user_follows WHERE user_id = ? AND room_id = ?",
        [req.user.id, roomId]
      );
      return res.json({ ok: true, followed: false, deleted: result.affectedRows > 0 });
    } catch (err) {
      console.error("[user follow delete]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
