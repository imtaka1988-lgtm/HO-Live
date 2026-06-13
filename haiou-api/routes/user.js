const express = require("express");
const userAuthMiddleware = require("../middleware/userAuth");

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

      res.json({
        ok: true,
        user: {
          id: u.id,
          phone: u.phone,
          nickname: u.nickname || "",
          avatar: u.avatar || "",
          level: u.level || 0,
          coins: u.coins || 0,
          status: u.status,
          createdAt: u.created_at
        }
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
