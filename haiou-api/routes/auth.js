const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

function normalizePhone(value) {
  const phone = String(value || "").trim().replace(/[\s-]+/g, "");
  return /^\+?\d{6,20}$/.test(phone) ? phone : "";
}

function normalizeNickname(value, phone) {
  const nickname = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
  return nickname || `海鸥用户${phone.slice(-4)}`;
}

module.exports = function (pool) {
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET;
  const bcryptRounds = Math.max(10, Math.min(Number.parseInt(process.env.BCRYPT_ROUNDS || "10", 10) || 10, 12));

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

  function issueToken(user) {
    return jwt.sign(
      { id: user.id, phone: user.phone, type: "user" },
      JWT_SECRET,
      { algorithm: "HS256", expiresIn: "30d" }
    );
  }

  router.post("/register", async (req, res) => {
    try {
      const phone = normalizePhone(req.body && req.body.phone);
      const password = String((req.body && req.body.password) || "");
      if (!phone) return res.status(400).json({ ok: false, error: "手机号格式不正确" });
      if (password.length < 6 || password.length > 64) {
        return res.status(400).json({ ok: false, error: "密码需要 6-64 位" });
      }
      const nickname = normalizeNickname(req.body && req.body.nickname, phone);
      const passwordHash = await bcrypt.hash(password, bcryptRounds);

      let result;
      try {
        [result] = await pool.query(
          "INSERT INTO users (phone, nickname, password_hash) VALUES (?, ?, ?)",
          [phone, nickname, passwordHash]
        );
      } catch (err) {
        if (err && err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ ok: false, error: "该手机号已注册" });
        }
        throw err;
      }

      const user = {
        id: result.insertId,
        phone,
        nickname,
        avatar: "",
        level: 0,
        coins: 0,
        status: "active"
      };
      return res.status(201).json({ ok: true, token: issueToken(user), user });
    } catch (err) {
      console.error("[user register]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const phone = normalizePhone(req.body && req.body.phone);
      const password = String((req.body && req.body.password) || "");
      if (!phone || !password) {
        return res.status(400).json({ ok: false, error: "请输入正确的手机号和密码" });
      }

      const [rows] = await pool.query(
        "SELECT id, phone, nickname, password_hash, avatar, level, coins, status FROM users WHERE phone = ? LIMIT 1",
        [phone]
      );
      if (rows.length === 0) {
        return res.status(401).json({ ok: false, error: "手机号或密码错误" });
      }

      const userRow = rows[0];
      const valid = await bcrypt.compare(password, userRow.password_hash);
      if (!valid) return res.status(401).json({ ok: false, error: "手机号或密码错误" });
      if (userRow.status !== "active") {
        return res.status(403).json({ ok: false, error: "账号已被限制" });
      }

      const user = publicUser(userRow);
      return res.json({ ok: true, token: issueToken(user), user });
    } catch (err) {
      console.error("[user login]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
