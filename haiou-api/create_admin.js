const bcrypt = require("bcryptjs");
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
    connectionLimit: 5
  });

  const hash = await bcrypt.hash("Admin@888", 10);
  await pool.query("INSERT IGNORE INTO admins (username, password_hash) VALUES (?, ?)", ["admin", hash]);
  console.log("ADMIN_OK");

  const [rows] = await pool.query("SELECT id, username FROM admins");
  console.log(JSON.stringify(rows[0]));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });

