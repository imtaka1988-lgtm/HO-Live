
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const fs = require("fs");
require("dotenv").config({path:"/var/www/haiou-api/.env"});

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
function genPass(len) {
  let pass = "";
  const buf = crypto.randomBytes(len * 2);
  for (let i = 0; i < len; i++) pass += CHARS[buf[i] % CHARS.length];
  return pass;
}

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

  const newPass = genPass(20);
  const hash = await bcrypt.hash(newPass, 10);

  await pool.query("UPDATE admins SET password_hash = ? WHERE username = ?", [hash, "admin"]);
  fs.writeFileSync("/root/haiou-admin-password.txt", newPass + "\n", { mode: 0o600 });

  // Check JWT_SECRET
  let jwtChanged = false;
  let envPath = "/var/www/haiou-api/.env";
  let envContent = fs.readFileSync(envPath, "utf8");
  if (!envContent.includes("JWT_SECRET")) {
    const jwtSecret = "s6lol-jwt-" + crypto.randomBytes(24).toString("hex");
    envContent += "\nJWT_SECRET=" + jwtSecret + "\n";
    fs.writeFileSync(envPath, envContent);
    jwtChanged = true;
    console.log("JWT_GENERATED");
  } else {
    console.log("JWT_EXISTS");
  }

  await pool.end();
  console.log("PASSWORD_UPDATED");
}
main().catch(e => { console.error(e.message); process.exit(1); });

