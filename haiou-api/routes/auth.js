const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

module.exports = function (pool) {
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET;

  function publicUser(row) {
    return {
      id: row.id,
      phone: row.phone,
      nickname: row.nickname || "",
      avatar: row.avatar || "",
      level: row.level || 0,
      coins: row.coins || 0,
      status: row.status || "active"
    };
  }

  router.post("/register", async (req, res) => {
    try {
      const phone = String(req.body.phone || "").trim();
      const password = String(req.body.password || "");
      const nickname = String(req.body.nickname || "").trim() || ("海鸥用户" + phone.slice(-4));

      if (!phone) return res.status(400).json({ ok: false, error: "请输入手机号" });
      if (password.length < 6 || password.length > 16) {
        return res.status(400).json({ ok: false, error: "密码需要 6-16 位" });
      }

      const [exists] = await pool.query("SELECT id FROM users WHERE phone = ?", [phone]);
      if (exists.length > 0) {
        return res.status(409).json({ ok: false, error: "该手机号已注册" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const [r] = await pool.query(
        "INSERT INTO users (phone, nickname, password_hash) VALUES (?, ?, ?)",
        [phone, nickname, passwordHash]
      );

      const user = {
        id: r.insertId,
        phone,
        nickname,
        avatar: "",
        level: 0,
        coins: 0,
        status: "active"
      };

      const token = jwt.sign(
        { id: user.id, phone: user.phone, type: "user" },
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      res.json({ ok: true, token, user });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const phone = String(req.body.phone || "").trim();
      const password = String(req.body.password || "");

      if (!phone || !password) {
        return res.status(400).json({ ok: false, error: "请输入手机号和密码" });
      }

      const [rows] = await pool.query(
        "SELECT id, phone, nickname, password_hash, avatar, level, coins, status FROM users WHERE phone = ?",
        [phone]
      );

      if (rows.length === 0) {
        return res.status(401).json({ ok: false, error: "手机号或密码错误" });
      }

      const userRow = rows[0];
      if (userRow.status !== "active") {
        return res.status(403).json({ ok: false, error: "账号已被限制" });
      }

      const valid = await bcrypt.compare(password, userRow.password_hash);
      if (!valid) {
        return res.status(401).json({ ok: false, error: "手机号或密码错误" });
      }

      const user = publicUser(userRow);
      const token = jwt.sign(
        { id: user.id, phone: user.phone, type: "user" },
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      res.json({ ok: true, token, user });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
