const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const anchorAuthMiddleware = require("../middleware/anchorAuth");

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
let avatarColumnReady = false;

function parseDataImage(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const ext = ALLOWED_MIME[match[1]];
  if (!ext) return null;
  return { ext, buffer: Buffer.from(match[2].replace(/\s+/g, ""), "base64") };
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

async function ensureAvatarColumn(pool) {
  if (avatarColumnReady) return;
  try {
    await pool.query("ALTER TABLE rooms ADD COLUMN anchor_avatar VARCHAR(500) NOT NULL DEFAULT ''");
  } catch (err) {
    if (!/Duplicate column/i.test(err.message || '')) throw err;
  }
  avatarColumnReady = true;
}

async function saveImage(dirName, prefix, parsed) {
  if (!parsed || !parsed.buffer.length) throw new Error("请上传 jpg、png 或 webp 图片");
  if (parsed.buffer.length > MAX_IMAGE_BYTES) throw new Error("图片不能超过 3MB");
  assertImageSignature(parsed);
  const uploadDir = path.join(__dirname, "..", "..", "haiou-live", "uploads", dirName);
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = prefix + "_" + Date.now() + "." + parsed.ext;
  await fs.writeFile(path.join(uploadDir, filename), parsed.buffer);
  return "/uploads/" + dirName + "/" + filename;
}

module.exports = function (pool) {
  const router = express.Router();

  router.post("/cover", anchorAuthMiddleware, async (req, res) => {
    try {
      const parsed = parseDataImage(req.body && req.body.image);
      const cover = await saveImage("covers", "room_" + req.anchor.roomId + "_cover", parsed);
      await pool.query("UPDATE rooms SET cover = ? WHERE id = ?", [cover, req.anchor.roomId]);
      res.json({ ok: true, cover });
    } catch (err) {
      console.error("[api error]", err);
      res.status(400).json({ ok: false, error: "请求失败" });
    }
  });

  router.post("/avatar", anchorAuthMiddleware, async (req, res) => {
    try {
      await ensureAvatarColumn(pool);
      const parsed = parseDataImage(req.body && req.body.image);
      const avatar = await saveImage("anchor_avatars", "room_" + req.anchor.roomId + "_avatar", parsed);
      await pool.query("UPDATE rooms SET anchor_avatar = ? WHERE id = ?", [avatar, req.anchor.roomId]);
      res.json({ ok: true, avatar });
    } catch (err) {
      console.error("[api error]", err);
      res.status(400).json({ ok: false, error: "请求失败" });
    }
  });

  return router;
};
