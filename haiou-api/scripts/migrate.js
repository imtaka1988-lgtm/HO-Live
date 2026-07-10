require("dotenv").config();

const mysql = require("mysql2/promise");

const DB_NAME = process.env.DB_NAME || "haiou_live";

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
    [DB_NAME, tableName, columnName]
  );
  return rows.length > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
    [DB_NAME, tableName, indexName]
  );
  return rows.length > 0;
}

async function addIndexIfMissing(connection, tableName, indexName, columnsSql) {
  if (await indexExists(connection, tableName, indexName)) return;
  await connection.query(`ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` (${columnsSql})`);
  console.log(`[migration] added ${tableName}.${indexName}`);
}

async function migrate() {
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
    await connection.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) NOT NULL PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    if (!(await columnExists(connection, "rooms", "anchor_avatar"))) {
      await connection.query("ALTER TABLE rooms ADD COLUMN anchor_avatar VARCHAR(500) NOT NULL DEFAULT ''");
      console.log("[migration] added rooms.anchor_avatar");
    }

    await connection.query(
      "CREATE TABLE IF NOT EXISTS user_exp_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, action VARCHAR(64) NOT NULL, ref_id VARCHAR(64) NOT NULL DEFAULT '', exp INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_user_action_ref (user_id, action, ref_id), KEY idx_user_id (user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    await addIndexIfMissing(connection, "chat_messages", "idx_chat_room_status_id", "room_id, status, id");
    await addIndexIfMissing(connection, "room_streams", "idx_stream_room_enabled_priority", "room_id, enabled, priority, id");
    await addIndexIfMissing(connection, "rooms", "idx_rooms_sort_id", "sort_order, id");

    await connection.query(
      "INSERT IGNORE INTO schema_migrations (name) VALUES (?)",
      ["20260710_pre_migration_hardening"]
    );
    console.log("[migration] complete");
  } finally {
    await connection.end();
  }
}

migrate().catch(err => {
  console.error("[migration] failed", err);
  process.exitCode = 1;
});
