require("dotenv").config();

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

async function main() {
  const username = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!/^[a-z0-9_.-]{3,64}$/.test(username)) {
    throw new Error("ADMIN_USERNAME must be 3-64 characters using letters, numbers, dot, underscore, or dash");
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error("ADMIN_PASSWORD must be 12-128 characters");
  }

  const dbPassword = process.env.DB_PASS || "";
  if (!dbPassword && process.env.ALLOW_EMPTY_DB_PASS !== "1") throw new Error("DB_PASS missing");
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.DB_PORT || "3306", 10) || 3306,
    database: process.env.DB_NAME || "haiou_live",
    user: process.env.DB_USER || "haiou_app",
    password: dbPassword
  });

  try {
    const rounds = Math.max(10, Math.min(Number.parseInt(process.env.BCRYPT_ROUNDS || "10", 10) || 10, 12));
    const hash = await bcrypt.hash(password, rounds);
    await connection.query(
      "INSERT INTO admins (username, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)",
      [username, hash]
    );
    console.log(`administrator account ready: ${username}`);
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error("[create-admin]", error.message);
  process.exitCode = 1;
});
