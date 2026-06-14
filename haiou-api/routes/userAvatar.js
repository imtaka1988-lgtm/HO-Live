const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const userAuthMiddleware = require("../middleware/userAuth");

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function parseDataImage(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = ALLOWED_MIME[mime];
  if (!ext) return null;
  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  return { mime, ext, buffer };
}

module.exports = function (pool) {
  const router = express.Router();

  router.post("/", userAuthMiddleware, async (req, res) => {
    try {
      const parsed = parseDataImage(req.body && req.body.image);
      if (!parsed) {
        return res.status(400).json({ ok: false, error: "请上传 jpg、png 或 webp 图片" });
      }

      if (!parsed.buffer.length) {
        return res.status(400).json({ ok: false, error: "图片内容为空" });
      }

      if (parsed.buffer.length > MAX_AVATAR_BYTES) {
        return res.status(400).json({ ok: false, error: "头像图片不能超过 2MB" });
      }

      const uploadDir = path.join(__dirname, "..", "..", "haiou-live", "uploads", "avatars");
      await fs.mkdir(uploadDir, { recursive: true });

      const filename = "user_" + req.user.id + "_" + Date.now() + "." + parsed.ext;
      const fullPath = path.join(uploadDir, filename);
      await fs.writeFile(fullPath, parsed.buffer);

      const avatar = "/uploads/avatars/" + filename;
      await pool.query("UPDATE users SET avatar = ? WHERE id = ?", [avatar, req.user.id]);

      res.json({ ok: true, avatar });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
