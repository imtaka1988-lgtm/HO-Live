const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");

function cleanSearch(value) {
  return String(value || "").trim().slice(0, 50);
}

function publicUser(row) {
  return {
    id: row.id,
    phone: row.phone,
    nickname: row.nickname || "",
    avatar: row.avatar || "",
    level: row.level || 0,
    coins: row.coins || 0,
    status: row.status || "active",
    createdAt: row.created_at || null
  };
}

function randomPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/users", authMiddleware, async (req, res) => {
    try {
      const q = cleanSearch(req.query.q);
      const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10) || 10, 1), 50);
      const page = Math.max(parseInt(req.query.page || "1", 10) || 1, 1);
      const offset = (page - 1) * limit;
      const params = [];
      let where = "";

      if (q) {
        where = "WHERE phone LIKE ? OR nickname LIKE ?";
        params.push("%" + q + "%", "%" + q + "%");
      }

      const [countRows] = await pool.query("SELECT COUNT(*) AS total FROM users " + where, params);
      const total = Number((countRows[0] && countRows[0].total) || 0);
      const totalPages = Math.max(Math.ceil(total / limit), 1);

      const listParams = params.concat([limit, offset]);
      const [rows] = await pool.query(
        "SELECT id, phone, nickname, avatar, level, coins, status, created_at FROM users " + where + " ORDER BY id DESC LIMIT ? OFFSET ?",
        listParams
      );

      res.json({ ok: true, users: rows.map(publicUser), query: q, page, limit, total, totalPages });
    } catch (err) {
      console.error("[admin users list]", err);
      res.status(500).json({ ok: false, error: "会员列表加载失败" });
    }
  });

  router.post("/users/:id/reset-password", authMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (!userId) return res.status(400).json({ ok: false, error: "无效的会员 ID" });

      const [users] = await pool.query("SELECT id, phone, nickname, status FROM users WHERE id = ?", [userId]);
      if (users.length === 0) return res.status(404).json({ ok: false, error: "会员不存在" });

      const newPassword = randomPassword();
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);

      res.json({
        ok: true,
        user: {
          id: users[0].id,
          phone: users[0].phone,
          nickname: users[0].nickname || "",
          status: users[0].status || "active"
        },
        newPassword
      });
    } catch (err) {
      console.error("[admin users reset password]", err);
      res.status(500).json({ ok: false, error: "重置密码失败" });
    }
  });

  return router;
};
