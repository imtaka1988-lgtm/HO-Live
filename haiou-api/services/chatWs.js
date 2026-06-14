const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// ===================== 聊天安全基础配置 =====================

const MAX_MESSAGE_LENGTH = 200;
const MIN_SEND_INTERVAL_MS = 3000;
const BURST_WINDOW_MS = 30000;
const MAX_BURST_MESSAGES = 6;
const REPEAT_WINDOW_MS = 60000;
const FIRST_CHAT_EXP_REWARD = 2;
const MAX_WS_CONNECTIONS_PER_IP = parseInt(process.env.CHAT_WS_MAX_CONNECTIONS_PER_IP || "20", 10) || 20;
const MAX_WS_CONNECTIONS_TOTAL = parseInt(process.env.CHAT_WS_MAX_CONNECTIONS_TOTAL || "1000", 10) || 1000;

let expLogTableReady = false;

// 只做基础过滤：广告、引流、博彩/下注类风险词、外链。
// 不放队名/球员/赛事名，避免正常体育聊天被误伤。
const BLOCKED_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\.com\b/i,
  /\.net\b/i,
  /\.top\b/i,
  /\.xyz\b/i,
  /加\s*微/i,
  /微信/i,
  /v\s*x/i,
  /v信/i,
  /qq\s*群/i,
  /telegram/i,
  /飞机群/i,
  /下注/i,
  /投注/i,
  /赌球/i,
  /博彩/i,
  /外围/i,
  /现金网/i,
  /娱乐城/i,
  /代充/i,
  /送彩金/i,
  /稳赚/i,
  /包赢/i
];

async function ensureExpLogTable(pool) {
  if (expLogTableReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS user_exp_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, action VARCHAR(64) NOT NULL, ref_id VARCHAR(64) NOT NULL DEFAULT '', exp INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_user_action_ref (user_id, action, ref_id), KEY idx_user_id (user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  expLogTableReady = true;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function levelFromExp(exp) {
  const n = Number(exp || 0);
  if (n >= 600) return 5;
  if (n >= 300) return 4;
  if (n >= 150) return 3;
  if (n >= 50) return 2;
  return 1;
}

async function addUserExp(pool, userId, amount) {
  const [rows] = await pool.query("SELECT coins, level FROM users WHERE id = ?", [userId]);
  if (!rows.length) return null;
  const exp = Number(rows[0].coins || 0) + amount;
  const level = Math.max(Number(rows[0].level || 1), levelFromExp(exp));
  await pool.query("UPDATE users SET coins = ?, level = ? WHERE id = ?", [exp, level, userId]);
  return { exp, level, added: amount };
}

async function awardUserExpOnce(pool, userId, action, refId, amount) {
  await ensureExpLogTable(pool);
  const [log] = await pool.query(
    "INSERT IGNORE INTO user_exp_logs (user_id, action, ref_id, exp) VALUES (?, ?, ?, ?)",
    [userId, action, String(refId || ''), amount]
  );
  if (log.affectedRows === 0) return null;
  return addUserExp(pool, userId, amount);
}

function normalizeText(v) {
  return String(v || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeText(v) {
  return normalizeText(v).slice(0, MAX_MESSAGE_LENGTH);
}

function hasBlockedContent(text) {
  return BLOCKED_PATTERNS.some(re => re.test(text));
}

function makeNotice(message) {
  return {
    type: "message",
    message: {
      id: 0,
      roomId: 0,
      userId: 0,
      nickname: "系统提醒",
      level: 0,
      role: "system",
      message,
      createdAt: new Date().toISOString()
    }
  };
}

function publicMessage(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    nickname: row.nickname || "海鸥用户",
    level: row.level || 0,
    message: row.message || "",
    createdAt: row.created_at
  };
}

function setupChatWs(server, pool) {
  const wss = new WebSocket.Server({ server, path: "/ws/chat" });
  const rooms = new Map();
  const userRateMap = new Map();
  const ipConnectionMap = new Map();
  let totalConnections = 0;

  function getClientIp(req) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return forwarded || req.socket.remoteAddress || "unknown";
  }

  function trackConnection(ip) {
    const current = ipConnectionMap.get(ip) || 0;
    if (totalConnections >= MAX_WS_CONNECTIONS_TOTAL) return false;
    if (current >= MAX_WS_CONNECTIONS_PER_IP) return false;
    ipConnectionMap.set(ip, current + 1);
    totalConnections += 1;
    return true;
  }

  function untrackConnection(ip) {
    const current = ipConnectionMap.get(ip) || 0;
    if (current <= 1) ipConnectionMap.delete(ip);
    else ipConnectionMap.set(ip, current - 1);
    totalConnections = Math.max(0, totalConnections - 1);
  }

  function addClient(roomId, ws) {
    const key = String(roomId);
    if (!rooms.has(key)) rooms.set(key, new Set());
    rooms.get(key).add(ws);
  }

  function removeClient(roomId, ws) {
    const key = String(roomId);
    const set = rooms.get(key);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) rooms.delete(key);
  }

  function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  function broadcast(roomId, data) {
    const set = rooms.get(String(roomId));
    if (!set) return;
    set.forEach(ws => send(ws, data));
  }

  function checkRateLimit(userId, text) {
    const now = Date.now();
    const key = String(userId);
    const state = userRateMap.get(key) || {
      lastAt: 0,
      lastText: "",
      lastTextAt: 0,
      times: []
    };

    if (state.lastAt && now - state.lastAt < MIN_SEND_INTERVAL_MS) {
      return "发言太快了，请稍等几秒再发送。";
    }

    state.times = state.times.filter(t => now - t < BURST_WINDOW_MS);
    if (state.times.length >= MAX_BURST_MESSAGES) {
      return "短时间发言过多，请休息一下再聊。";
    }

    if (state.lastText === text && now - state.lastTextAt < REPEAT_WINDOW_MS) {
      return "请不要重复发送相同内容。";
    }

    state.lastAt = now;
    state.lastText = text;
    state.lastTextAt = now;
    state.times.push(now);
    userRateMap.set(key, state);
    return "";
  }

  wss.on("connection", async (ws, req) => {
    let roomId = 0;
    let user = null;
    const ip = getClientIp(req);
    let tracked = false;

    if (!trackConnection(ip)) {
      send(ws, { type: "error", error: "聊天室连接过多，请稍后再试。" });
      ws.close(1008, "too many connections");
      return;
    }
    tracked = true;

    ws.on("close", () => {
      if (tracked) {
        untrackConnection(ip);
        tracked = false;
      }
      if (roomId) removeClient(roomId, ws);
    });

    try {
      const url = new URL(req.url, "http://127.0.0.1");
      roomId = parseInt(url.searchParams.get("roomId") || "0");
      const token = url.searchParams.get("token") || "";

      if (!roomId) {
        send(ws, { type: "error", error: "无效的房间" });
        ws.close(1008, "invalid room");
        return;
      }

      if (!token) {
        send(ws, { type: "error", error: "未登录" });
        ws.close(1008, "no token");
        return;
      }

      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.type !== "user") {
        send(ws, { type: "error", error: "用户身份无效" });
        ws.close(1008, "invalid user");
        return;
      }

      const [roomRows] = await pool.query("SELECT id FROM rooms WHERE id = ?", [roomId]);
      if (roomRows.length === 0) {
        send(ws, { type: "error", error: "房间不存在" });
        ws.close(1008, "room not found");
        return;
      }

      const [userRows] = await pool.query(
        "SELECT id, phone, nickname, level, status FROM users WHERE id = ?",
        [payload.id]
      );

      if (userRows.length === 0 || userRows[0].status !== "active") {
        send(ws, { type: "error", error: "用户不存在或已被限制" });
        ws.close(1008, "user blocked");
        return;
      }

      user = userRows[0];
      addClient(roomId, ws);

      send(ws, {
        type: "ready",
        roomId,
        user: {
          id: user.id,
          nickname: user.nickname || "海鸥用户",
          level: user.level || 0
        }
      });

      const [historyRows] = await pool.query(
        "SELECT id, room_id, user_id, nickname, level, message, created_at FROM chat_messages WHERE room_id = ? AND status = 'normal' ORDER BY id DESC LIMIT 50",
        [roomId]
      );

      send(ws, {
        type: "history",
        messages: historyRows.reverse().map(publicMessage)
      });

    } catch (err) {
      send(ws, { type: "error", error: "登录已过期" });
      ws.close(1008, "auth failed");
      return;
    }

    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type !== "message") return;

        const originalText = normalizeText(data.message);
        if (!originalText) return;

        if (originalText.length > MAX_MESSAGE_LENGTH) {
          send(ws, makeNotice("消息太长了，请控制在 200 字以内。"));
          return;
        }

        const text = safeText(originalText);

        if (hasBlockedContent(text)) {
          send(ws, makeNotice("消息包含不适合发布的内容，已被拦截。"));
          return;
        }

        const rateError = checkRateLimit(user.id, text);
        if (rateError) {
          send(ws, makeNotice(rateError));
          return;
        }

        try {
          const reward = await awardUserExpOnce(pool, user.id, "daily_first_chat", todayKey(), FIRST_CHAT_EXP_REWARD);
          if (reward && reward.level) user.level = reward.level;
        } catch (e) {}

        const [r] = await pool.query(
          "INSERT INTO chat_messages (room_id, user_id, nickname, level, message) VALUES (?, ?, ?, ?, ?)",
          [roomId, user.id, user.nickname || "海鸥用户", user.level || 0, text]
        );

        const msg = {
          type: "message",
          message: {
            id: r.insertId,
            roomId,
            userId: user.id,
            nickname: user.nickname || "海鸥用户",
            level: user.level || 0,
            message: text,
            createdAt: new Date().toISOString()
          }
        };

        broadcast(roomId, msg);
      } catch (err) {
        send(ws, makeNotice("消息发送失败，请稍后再试。"));
      }
    });
  });

  console.log("[ChatWS] WebSocket ready: /ws/chat");
}

module.exports = setupChatWs;
