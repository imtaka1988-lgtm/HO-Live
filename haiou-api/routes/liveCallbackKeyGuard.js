const express = require("express");
const crypto = require("crypto");

function envEnabled(name) {
  const value = String(process.env[name] || "").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function callbackKeyError(req) {
  const expected = String(process.env.LIVE_CALLBACK_KEY || "");
  if (!expected) return envEnabled("LIVE_CALLBACK_ALLOW_UNSIGNED") ? "" : "callback key missing";

  let received = String(req.headers["x-live-callback-key"] || "");
  if (!received && envEnabled("LIVE_CALLBACK_ALLOW_QUERY_KEY")) received = String(req.query.key || "");
  return safeEqual(received, expected) ? "" : "callback key invalid";
}

function firstValue(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null && object[key] !== "") return object[key];
  }
  return "";
}

function normalizeStreamName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return (raw.split("?")[0].split("/").filter(Boolean).pop() || raw).slice(0, 128);
}

function liveStatusFromEvent(value) {
  const normalized = String(value || "").toLowerCase();
  if (["1", "start", "started", "publish", "published", "push", "online", "live", "stream_begin", "begin"].includes(normalized)) return "live";
  if (["0", "stop", "stopped", "unpublish", "unpublished", "disconnect", "offline", "end", "stream_end", "close"].includes(normalized)) return "offline";
  return "";
}

function safeEventJson(body, query) {
  const safeQuery = { ...(query || {}) };
  delete safeQuery.key;
  let raw = JSON.stringify({ body: body || {}, query: safeQuery });
  if (Buffer.byteLength(raw) > 64 * 1024) {
    raw = JSON.stringify({ truncated: true, preview: raw.slice(0, 60000) });
  }
  return raw;
}

async function findRoomId(connection, streamName) {
  if (!streamName) return 0;
  const [profiles] = await connection.query(
    "SELECT room_id AS roomId FROM room_stream_profiles WHERE stream_name = ? OR obs_stream_key = ? LIMIT 1",
    [streamName, streamName]
  );
  if (profiles.length) return Number(profiles[0].roomId || 0);
  const match = streamName.match(/^room(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

module.exports = function (pool) {
  const router = express.Router();

  router.post("/", async (req, res) => {
    const keyError = callbackKeyError(req);
    if (keyError) return res.status(403).json({ ok: false, error: keyError });

    const body = req.body || {};
    const query = req.query || {};
    const provider = String(firstValue(body, ["provider", "vendor"]) || query.provider || "generic")
      .toLowerCase()
      .slice(0, 32);
    const streamName = normalizeStreamName(
      firstValue(body, ["streamName", "stream_name", "stream_id", "stream", "StreamName", "StreamId"]) ||
      firstValue(query, ["streamName", "stream_name", "stream_id", "stream"])
    );
    const eventRaw = String(
      firstValue(body, ["event", "eventType", "event_type", "action", "status", "Status"]) ||
      firstValue(query, ["event", "eventType", "event_type", "action", "status"]) ||
      ""
    ).slice(0, 64);
    const status = liveStatusFromEvent(eventRaw);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const roomId = await findRoomId(connection, streamName);
      await connection.query(
        "INSERT INTO live_stream_events (provider, room_id, stream_name, event_type, raw_json) VALUES (?, ?, ?, ?, ?)",
        [provider, roomId || null, streamName, eventRaw, safeEventJson(body, query)]
      );

      if (roomId && status) {
        await connection.query("UPDATE rooms SET status = ? WHERE id = ?", [status, roomId]);
      }
      await connection.commit();

      if (!roomId || !status) {
        return res.json({ ok: true, matched: false, roomId, streamName, status, message: "event recorded only" });
      }
      return res.json({ ok: true, matched: true, roomId, streamName, status });
    } catch (err) {
      try { await connection.rollback(); } catch (_) {}
      console.error("[live callback]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    } finally {
      connection.release();
    }
  });

  return router;
};
