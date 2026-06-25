const express = require("express");
const authMiddleware = require("../middleware/auth");

async function deleteOptional(conn, sql, params) {
  try {
    const [result] = await conn.query(sql, params);
    return result && result.affectedRows ? result.affectedRows : 0;
  } catch (err) {
    if (/ER_NO_SUCH_TABLE|doesn't exist/i.test(err.code || err.message || "")) return 0;
    throw err;
  }
}

module.exports = function (pool) {
  const router = express.Router();

  router.delete("/rooms/:id", authMiddleware, async (req, res) => {
    let conn = null;
    try {
      const roomId = parseInt(req.params.id, 10);
      if (!roomId) return res.status(400).json({ ok: false, error: "无效的房间 ID" });

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [rooms] = await conn.query("SELECT id, title FROM rooms WHERE id = ?", [roomId]);
      if (!rooms.length) {
        await conn.rollback();
        return res.status(404).json({ ok: false, error: "房间不存在" });
      }

      const cleanup = {
        streams: await deleteOptional(conn, "DELETE FROM room_streams WHERE room_id = ?", [roomId]),
        streamProfiles: await deleteOptional(conn, "DELETE FROM room_stream_profiles WHERE room_id = ?", [roomId]),
        anchors: await deleteOptional(conn, "DELETE FROM anchors WHERE room_id = ?", [roomId]),
        liveEvents: await deleteOptional(conn, "DELETE FROM live_stream_events WHERE room_id = ?", [roomId])
      };

      const [deleted] = await conn.query("DELETE FROM rooms WHERE id = ?", [roomId]);
      await conn.commit();

      res.json({ ok: true, deleted: deleted.affectedRows, room: rooms[0], cleanup });
    } catch (err) {
      if (conn) {
        try { await conn.rollback(); } catch (e) {}
      }
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
    } finally {
      if (conn) conn.release();
    }
  });

  return router;
};
