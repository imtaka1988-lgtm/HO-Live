const express = require("express");

let callbackTableReady = false;

async function ensureCallbackTable(pool) {
  if (callbackTableReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS live_stream_events (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, provider VARCHAR(32) NOT NULL DEFAULT 'generic', room_id INT UNSIGNED NULL, stream_name VARCHAR(128) NOT NULL DEFAULT '', event_type VARCHAR(64) NOT NULL DEFAULT '', raw_json JSON NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, KEY idx_room_time (room_id, created_at), KEY idx_stream_time (stream_name, created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  callbackTableReady = true;
}

function firstValue(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return '';
}

function normalizeStreamName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.split('?')[0].split('/').filter(Boolean).pop() || raw;
}

function liveStatusFromEvent(value) {
  const v = String(value || '').toLowerCase();
  if (["1", "start", "started", "publish", "published", "push", "online", "live", "stream_begin", "begin"].includes(v)) return "live";
  if (["0", "stop", "stopped", "unpublish", "unpublished", "disconnect", "offline", "end", "stream_end", "close"].includes(v)) return "offline";
  return "";
}

async function findRoomId(pool, streamName) {
  if (!streamName) return 0;
  const [profiles] = await pool.query(
    "SELECT room_id AS roomId FROM room_stream_profiles WHERE stream_name = ? OR obs_stream_key = ? LIMIT 1",
    [streamName, streamName]
  );
  if (profiles.length) return Number(profiles[0].roomId || 0);

  const m = streamName.match(/^room(\d+)$/i);
  if (m) return Number(m[1]);
  return 0;
}

module.exports = function (pool) {
  const router = express.Router();

  router.post("/", async (req, res) => {
    try {
      const secret = process.env.LIVE_CALLBACK_SECRET || '';
      if (secret) {
        const got = req.query.secret || req.headers['x-live-callback-secret'] || '';
        if (String(got) !== String(secret)) return res.status(403).json({ ok: false, error: 'secret invalid' });
      }

      await ensureCallbackTable(pool);

      const body = req.body || {};
      const query = req.query || {};
      const provider = String(firstValue(body, ['provider', 'vendor']) || query.provider || 'generic').toLowerCase();
      const streamName = normalizeStreamName(firstValue(body, ['streamName', 'stream_name', 'stream_id', 'stream', 'StreamName', 'StreamId']) || firstValue(query, ['streamName', 'stream_name', 'stream_id', 'stream']));
      const eventRaw = firstValue(body, ['event', 'eventType', 'event_type', 'action', 'status', 'Status']) || firstValue(query, ['event', 'eventType', 'event_type', 'action', 'status']);
      const status = liveStatusFromEvent(eventRaw);
      const roomId = await findRoomId(pool, streamName);

      await pool.query(
        "INSERT INTO live_stream_events (provider, room_id, stream_name, event_type, raw_json) VALUES (?, ?, ?, ?, ?)",
        [provider, roomId || null, streamName, String(eventRaw || ''), JSON.stringify({ body, query })]
      );

      if (!roomId || !status) {
        return res.json({ ok: true, matched: false, roomId, streamName, status, message: 'event recorded only' });
      }

      await pool.query("UPDATE rooms SET status = ? WHERE id = ?", [status, roomId]);
      res.json({ ok: true, matched: true, roomId, streamName, status });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
