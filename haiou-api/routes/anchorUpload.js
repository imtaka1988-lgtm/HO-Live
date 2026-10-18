const express = require("express");
const anchorAuthMiddleware = require("../middleware/anchorAuth");
const { saveDataImage, removeUploadedFile } = require("../services/imageStorage");

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

async function updateRoomImage(pool, roomId, column, dirName, prefix, imageValue) {
  const [rows] = await pool.query(`SELECT id, ${column} AS previousImage FROM rooms WHERE id = ? LIMIT 1`, [roomId]);
  if (!rows.length) {
    const error = new Error("直播间不存在");
    error.statusCode = 404;
    throw error;
  }

  const uploaded = await saveDataImage({
    value: imageValue,
    dirName,
    prefix,
    maxBytes: MAX_IMAGE_BYTES
  });

  try {
    await pool.query(`UPDATE rooms SET ${column} = ? WHERE id = ?`, [uploaded, roomId]);
  } catch (err) {
    await removeUploadedFile(uploaded);
    throw err;
  }

  await removeUploadedFile(rows[0].previousImage);
  return uploaded;
}

module.exports = function (pool) {
  const router = express.Router();

  router.post("/cover", anchorAuthMiddleware, async (req, res) => {
    try {
      const roomId = Number.parseInt(req.anchor.roomId, 10);
      if (!roomId) return res.status(403).json({ ok: false, error: "主播未绑定直播间" });
      const cover = await updateRoomImage(
        pool,
        roomId,
        "cover",
        "covers",
        `room_${roomId}_cover`,
        req.body && req.body.image
      );
      return res.json({ ok: true, cover });
    } catch (err) {
      console.error("[anchor cover upload]", err);
      const status = err.statusCode || (/图片|上传/.test(err.message || "") ? 400 : 500);
      return res.status(status).json({ ok: false, error: status === 500 ? "服务器错误" : err.message });
    }
  });

  router.post("/avatar", anchorAuthMiddleware, async (req, res) => {
    try {
      const roomId = Number.parseInt(req.anchor.roomId, 10);
      if (!roomId) return res.status(403).json({ ok: false, error: "主播未绑定直播间" });
      const avatar = await updateRoomImage(
        pool,
        roomId,
        "anchor_avatar",
        "anchor_avatars",
        `room_${roomId}_avatar`,
        req.body && req.body.image
      );
      return res.json({ ok: true, avatar });
    } catch (err) {
      console.error("[anchor avatar upload]", err);
      const status = err.statusCode || (/图片|上传/.test(err.message || "") ? 400 : 500);
      return res.status(status).json({ ok: false, error: status === 500 ? "服务器错误" : err.message });
    }
  });

  return router;
};
