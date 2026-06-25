
const mysql = require("mysql2/promise");
require("dotenv").config({path:"/var/www/haiou-api/.env"});

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

  const cols = [
    { name: "provider", type: "VARCHAR(50) DEFAULT 'tencent'", after: "priority" },
    { name: "mode", type: "VARCHAR(50) DEFAULT 'room_fixed'", after: "provider" },
    { name: "app_name", type: "VARCHAR(100) DEFAULT 'live'", after: "mode" },
    { name: "stream_name", type: "VARCHAR(255) DEFAULT ''", after: "app_name" },
    { name: "device_policy", type: "VARCHAR(50) DEFAULT 'auto'", after: "stream_name" },
    { name: "remark", type: "VARCHAR(500) DEFAULT ''", after: "device_policy" },
  ];

  for (const c of cols) {
    try {
      await pool.query(`ALTER TABLE room_streams ADD COLUMN ${c.name} ${c.type} AFTER ${c.after}`);
      console.log("ADDED:", c.name);
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("SKIP:", c.name, "(already exists)");
      } else {
        console.error("ERR:", c.name, e.message);
      }
    }
  }

  const [rows] = await pool.query("DESCRIBE room_streams");
  rows.forEach(r => console.log(r.Field, r.Type));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });

