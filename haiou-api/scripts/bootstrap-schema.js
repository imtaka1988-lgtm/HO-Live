require("dotenv").config();

const mysql = require("mysql2/promise");

const DB_NAME = process.env.DB_NAME || "haiou_live";

const CORE_SCHEMA = [
  {
    name: "rooms",
    sql: `CREATE TABLE IF NOT EXISTS rooms (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(200) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'football',
      status VARCHAR(24) NOT NULL DEFAULT 'offline',
      cover VARCHAR(500) NOT NULL DEFAULT '',
      anchor_name VARCHAR(100) NOT NULL DEFAULT '',
      anchor_avatar VARCHAR(500) NOT NULL DEFAULT '',
      announcement VARCHAR(1000) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_rooms_sort_id (sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  },
  {
    name: "room_streams",
    sql: `CREATE TABLE IF NOT EXISTS room_streams (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      room_id INT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL DEFAULT '',
      type VARCHAR(20) NOT NULL DEFAULT 'hls',
      url VARCHAR(1000) NOT NULL DEFAULT '',
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      priority INT NOT NULL DEFAULT 99,
      provider VARCHAR(50) NOT NULL DEFAULT 'manual',
      mode VARCHAR(50) NOT NULL DEFAULT 'room_fixed',
      app_name VARCHAR(100) NOT NULL DEFAULT 'live',
      stream_name VARCHAR(255) NOT NULL DEFAULT '',
      device_policy VARCHAR(50) NOT NULL DEFAULT 'auto',
      remark VARCHAR(500) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_stream_room_enabled_priority (room_id, enabled, priority, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  },
  {
    name: "users",
    sql: `CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      phone VARCHAR(32) NOT NULL,
      nickname VARCHAR(100) NOT NULL DEFAULT '',
      password_hash VARCHAR(255) NOT NULL,
      avatar VARCHAR(500) NOT NULL DEFAULT '',
      level INT UNSIGNED NOT NULL DEFAULT 0,
      coins BIGINT UNSIGNED NOT NULL DEFAULT 0,
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_users_phone (phone),
      KEY idx_users_status_id (status, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  },
  {
    name: "chat_messages",
    sql: `CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      room_id INT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
      nickname VARCHAR(100) NOT NULL DEFAULT '',
      level INT UNSIGNED NOT NULL DEFAULT 0,
      message TEXT NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'normal',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_chat_room_status_id (room_id, status, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  }
];

async function ensureCoreSchema(connection) {
  for (const table of CORE_SCHEMA) {
    await connection.query(table.sql);
    console.log(`[bootstrap] ready: ${table.name}`);
  }
  return CORE_SCHEMA.map(table => table.name);
}

async function bootstrapSchema() {
  const password = process.env.DB_PASS || "";
  if (!password && process.env.ALLOW_EMPTY_DB_PASS !== "1") {
    throw new Error("DB_PASS missing. Set ALLOW_EMPTY_DB_PASS=1 only for an intentional empty password.");
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.DB_PORT || "3306", 10) || 3306,
    database: DB_NAME,
    user: process.env.DB_USER || "haiou_app",
    password,
    multipleStatements: false
  });

  try {
    const names = await ensureCoreSchema(connection);
    console.log(`[bootstrap] core schema ready in database "${DB_NAME}": ${names.join(", ")}`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  bootstrapSchema().catch(err => {
    console.error("[bootstrap] failed:", err && err.message ? err.message : err);
    process.exitCode = 1;
  });
}

module.exports = { CORE_SCHEMA, ensureCoreSchema, bootstrapSchema };
