const fs = require("fs");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: "/var/www/haiou-api/.env" });

const json = JSON.parse(fs.readFileSync("/var/www/haiou-live/assets/data/site-config.json", "utf8"));
const rooms = json.rooms || [];

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

  // Clear existing data
  await pool.query("DELETE FROM room_streams");
  await pool.query("DELETE FROM rooms");

  let roomCount = 0;
  let streamCount = 0;

  for (const r of rooms) {
    const hostName = (json.hosts || []).find(h => h.id === r.hostId);
    const anchorName = hostName ? hostName.name : "";

    await pool.query(
      "INSERT INTO rooms (id, title, category, status, cover, anchor_name, announcement, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [r.id, r.title || "", r.category || "football", r.status || "live", r.cover || "", anchorName, "", r.sort || 0]
    );
    roomCount++;
  }

  for (const r of rooms) {
    const streams = r.streams || [];
    for (const s of streams) {
      await pool.query(
        "INSERT INTO room_streams (room_id, name, type, url, is_default, enabled, priority) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [r.id, s.name || "", s.type || "hls", s.url || "", s.default ? 1 : 0, s.enabled !== false ? 1 : 0, s.priority || 99]
      );
      streamCount++;
    }
  }

  await pool.end();
  console.log("ROOMS=" + roomCount + " STREAMS=" + streamCount);
}

main().catch(e => { console.error(e.message); process.exit(1); });

