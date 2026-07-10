const express = require("express");
const userAuthMiddleware = require("../middleware/userAuth");
const { saveDataImage, removeUploadedFile } = require("../services/imageStorage");

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

module.exports = function (pool) {
  const router = express.Router();

  router.post("/", userAuthMiddleware, async (req, res) => {
    let uploaded = "";
    try {
      const [rows] = await pool.query("SELECT avatar FROM users WHERE id = ? LIMIT 1", [req.user.id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: "用户不存在" });

      uploaded = await saveDataImage({
        value: req.body && req.body.image,
        dirName: "avatars",
        prefix: `user_${req.user.id}`,
        maxBytes: MAX_AVATAR_BYTES
      });
      await pool.query("UPDATE users SET avatar = ? WHERE id = ?", [uploaded, req.user.id]);
      await removeUploadedFile(rows[0].avatar);
      return res.json({ ok: true, avatar: uploaded });
    } catch (err) {
      if (uploaded) await removeUploadedFile(uploaded);
      console.error("[user avatar upload]", err);
      const status = /图片|上传/.test(err.message || "") ? 400 : 500;
      return res.status(status).json({ ok: false, error: status === 500 ? "服务器错误" : err.message });
    }
  });

  return router;
};
