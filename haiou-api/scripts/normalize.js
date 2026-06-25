
const mysql = require("mysql2/promise");
require("dotenv").config({ path: "/var/www/haiou-api/.env" });

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306"),
    database: process.env.DB_NAME || "haiou_live",
    user: process.env.DB_USER || "haiou_app",
    password: process.env.DB_PASS || "",
    waitForConnections: true,
    connectionLimit: 5,
  });

  const [rooms] = await pool.query("SELECT id FROM rooms");
  let deleted = 0, updatedHls = 0, createdFlv = 0, clearedUrl = 0;

  for (const room of rooms) {
    const rid = room.id;
    // Get all streams for this room
    const [streams] = await pool.query("SELECT id, type, url, name FROM room_streams WHERE room_id = ? ORDER BY priority, id", [rid]);

    // Find HLS and FLV streams
    const hlsStreams = streams.filter(s => s.type === "hls");
    const flvStreams = streams.filter(s => s.type === "flv");

    // Keep first HLS, delete others
    if (hlsStreams.length > 0) {
      const keep = hlsStreams[0];
      // Update the kept HLS to standard values
      await pool.query(
        "UPDATE room_streams SET name = ?, priority = 1, enabled = 1, is_default = 1, device_policy = 'auto', provider = 'tencent', mode = 'room_fixed', app_name = 'live' WHERE id = ?",
        ["主线路（HLS）", keep.id]
      );
      updatedHls++;

      // Delete extra HLS streams
      for (let i = 1; i < hlsStreams.length; i++) {
        await pool.query("DELETE FROM room_streams WHERE id = ?", [hlsStreams[i].id]);
        deleted++;
      }
    } else {
      // No HLS at all — create one (use first stream's URL if available)
      const anyUrl = streams.length > 0 ? streams[0].url : "";
      await pool.query(
        "INSERT INTO room_streams (room_id, name, type, url, is_default, enabled, priority, provider, mode, app_name, device_policy) VALUES (?, '主线路（HLS）', 'hls', ?, 1, 1, 1, 'tencent', 'room_fixed', 'live', 'auto')",
        [rid, anyUrl]
      );
      createdFlv++; // counted as created
    }

    // Now handle FLV: keep first, or create if none
    const [remaining] = await pool.query("SELECT id, type, url FROM room_streams WHERE room_id = ? AND type = 'flv'", [rid]);

    if (remaining.length > 0) {
      const flv = remaining[0];
      // If FLV URL ends with .m3u8, clear it (wrong format)
      let flvUrl = flv.url;
      if (flvUrl && flvUrl.includes(".m3u8")) {
        flvUrl = "";
        clearedUrl++;
      }
      await pool.query(
        "UPDATE room_streams SET name = ?, priority = 2, enabled = 0, is_default = 0, device_policy = 'pc', provider = 'tencent', mode = 'room_fixed', app_name = 'live', url = ?, stream_name = '' WHERE id = ?",
        ["极速线路（FLV）", flvUrl, flv.id]
      );
      // Delete any extra FLV
      for (let i = 1; i < remaining.length; i++) {
        await pool.query("DELETE FROM room_streams WHERE id = ?", [remaining[i].id]);
        deleted++;
      }
    } else {
      // Create FLV (disabled, no URL)
      await pool.query(
        "INSERT INTO room_streams (room_id, name, type, url, is_default, enabled, priority, provider, mode, app_name, device_policy) VALUES (?, '极速线路（FLV）', 'flv', '', 0, 0, 2, 'tencent', 'room_fixed', 'live', 'pc')",
        [rid]
      );
      createdFlv++;
    }

    // Delete any remaining streams that are not HLS or FLV
    const [others] = await pool.query("DELETE FROM room_streams WHERE room_id = ? AND type NOT IN ('hls', 'flv')", [rid]);
    deleted += others.affectedRows;
  }

  // Also update /api/public/rooms to filter enabled + non-empty URL
  // This is done in server.js

  const [count] = await pool.query("SELECT COUNT(*) AS cnt FROM room_streams");
  console.log("TOTAL_STREAMS=" + count[0].cnt);
  console.log("DELETED=" + deleted);
  console.log("UPDATED_HLS=" + updatedHls);
  console.log("CREATED_FLV=" + createdFlv);
  console.log("CLEARED_URL=" + clearedUrl);

  // Show per-room summary
  const [summary] = await pool.query(
    "SELECT r.id, r.title, COUNT(s.id) AS cnt, GROUP_CONCAT(s.type ORDER BY s.priority SEPARATOR ', ') AS types FROM rooms r LEFT JOIN room_streams s ON r.id = s.room_id GROUP BY r.id ORDER BY r.id"
  );
  summary.forEach(r => console.log("Room " + r.id + ": " + r.cnt + " streams [" + r.types + "]"));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });

