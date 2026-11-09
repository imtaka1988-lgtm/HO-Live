import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { CORE_SCHEMA, ensureCoreSchema } = require("../scripts/bootstrap-schema.js");

test("fresh-install bootstrap includes all required core tables", async () => {
  const executed = [];
  const connection = {
    async query(sql) {
      executed.push(sql);
      return [[], []];
    }
  };

  const ready = await ensureCoreSchema(connection);

  assert.deepEqual(ready, ["rooms", "room_streams", "users", "chat_messages"]);
  assert.equal(executed.length, CORE_SCHEMA.length);
  for (const sql of executed) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS/);
    assert.match(sql, /ENGINE=InnoDB/);
    assert.match(sql, /CHARSET=utf8mb4/);
  }
});

test("base-table columns and indexes cover routes and the incremental migrator", () => {
  const sqlByName = Object.fromEntries(CORE_SCHEMA.map(table => [table.name, table.sql]));

  assert.match(sqlByName.rooms, /anchor_name/);
  assert.match(sqlByName.rooms, /anchor_avatar/);
  assert.match(sqlByName.rooms, /sort_order/);
  assert.match(sqlByName.rooms, /idx_rooms_sort_id/);

  assert.match(sqlByName.room_streams, /is_default/);
  assert.match(sqlByName.room_streams, /enabled/);
  assert.match(sqlByName.room_streams, /priority/);
  assert.match(sqlByName.room_streams, /idx_stream_room_enabled_priority/);

  assert.match(sqlByName.users, /password_hash/);
  assert.match(sqlByName.users, /UNIQUE KEY uniq_users_phone/);
  assert.match(sqlByName.users, /status/);

  assert.match(sqlByName.chat_messages, /room_id/);
  assert.match(sqlByName.chat_messages, /user_id/);
  assert.match(sqlByName.chat_messages, /status/);
  assert.match(sqlByName.chat_messages, /idx_chat_room_status_id/);
});
