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

function detectImageExt(buffer) {
  if (!Buffer.isBuffer(buffer)) return "";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) return "png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return "";
}

function assertImageSignature(parsed) {
  const actualExt = detectImageExt(parsed && parsed.buffer);
  if (!actualExt) throw new Error("图片文件内容不合法");
  if (actualExt !== parsed.ext) throw new Error("图片格式与文件内容不一致");
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

      assertImageSignature(parsed);

      const uploadDir = path.join(__dirname, "..", "..", "haiou-live", "uploads", "avatars");
      await fs.mkdir(uploadDir, { recursive: true });

      const filename = "user_" + req.user.id + "_" + Date.now() + "." + parsed.ext;
      const fullPath = path.join(uploadDir, filename);
      await fs.writeFile(fullPath, parsed.buffer);

      const avatar = "/uploads/avatars/" + filename;
      await pool.query("UPDATE users SET avatar = ? WHERE id = ?", [avatar, req.user.id]);

      res.json({ ok: true, avatar });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
