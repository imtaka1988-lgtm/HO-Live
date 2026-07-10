const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const MAX_MESSAGE_LENGTH = 200;
const MIN_SEND_INTERVAL_MS = 3000;
const BURST_WINDOW_MS = 30000;
const MAX_BURST_MESSAGES = 6;
const REPEAT_WINDOW_MS = 60000;
const FIRST_CHAT_EXP_REWARD = 2;
const MAX_WS_CONNECTIONS_PER_IP = Number.parseInt(process.env.CHAT_WS_MAX_CONNECTIONS_PER_IP || "20", 10) || 20;
const MAX_WS_CONNECTIONS_TOTAL = Number.parseInt(process.env.CHAT_WS_MAX_CONNECTIONS_TOTAL || "1000", 10) || 1000;
const MAX_WS_PAYLOAD_BYTES = Number.parseInt(process.env.CHAT_WS_MAX_PAYLOAD_BYTES || "16384", 10) || 16384;
const MAX_WS_BUFFERED_BYTES = Number.parseInt(process.env.CHAT_WS_MAX_BUFFERED_BYTES || "1048576", 10) || 1048576;
const AUTH_TIMEOUT_MS = Number.parseInt(process.env.CHAT_WS_AUTH_TIMEOUT_MS || "5000", 10) || 5000;
const HEARTBEAT_INTERVAL_MS = Number.parseInt(process.env.CHAT_WS_HEARTBEAT_MS || "30000", 10) || 30000;
const RATE_STATE_TTL_MS = 30 * 60 * 1000;
const HISTORY_LIMIT = Math.max(1, Math.min(Number.parseInt(process.env.CHAT_HISTORY_LIMIT || "50", 10) || 50, 100));

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

function beijingDayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function levelFromExp(exp) {
  const value = Number(exp || 0);
  if (value >= 600) return 5;
  if (value >= 300) return 4;
  if (value >= 150) return 3;
  if (value >= 50) return 2;
  return 1;
}

async function addUserExp(pool, userId, amount) {
  const [result] = await pool.query("UPDATE users SET coins = coins + ? WHERE id = ?", [amount, userId]);
  if (result.affectedRows === 0) return null;
  const [rows] = await pool.query("SELECT coins, level FROM users WHERE id = ? LIMIT 1", [userId]);
  if (!rows.length) return null;
  const exp = Number(rows[0].coins || 0);
  const level = Math.max(Number(rows[0].level || 1), levelFromExp(exp));
  if (level !== Number(rows[0].level || 1)) {
    await pool.query("UPDATE users SET level = ? WHERE id = ?", [level, userId]);
  }
  return { exp, level, added: amount };
}

async function awardUserExpOnce(pool, userId, action, refId, amount) {
  const [log] = await pool.query(
    "INSERT IGNORE INTO user_exp_logs (user_id, action, ref_id, exp) VALUES (?, ?, ?, ?)",
    [userId, action, String(refId || ""), amount]
  );
  if (log.affectedRows === 0) return null;
  return addUserExp(pool, userId, amount);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasBlockedContent(text) {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(text));
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
  const wss = new WebSocket.Server({
    server,
    path: "/ws/chat",
    maxPayload: MAX_WS_PAYLOAD_BYTES,
    perMessageDeflate: false
  });
  const rooms = new Map();
  const userRateMap = new Map();
  const ipConnectionMap = new Map();
  let totalConnections = 0;

  function getClientIp(req) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return (forwarded || req.socket.remoteAddress || "unknown").slice(0, 120);
  }

  function isOriginAllowed(req) {
    const origin = String(req.headers.origin || "").trim();
    if (!origin) return true;
    const configured = String(process.env.CHAT_ALLOWED_ORIGINS || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);
    if (configured.length) return configured.includes(origin);
    try {
      return new URL(origin).host === String(req.headers.host || "");
    } catch (_) {
      return false;
    }
  }

  function trackConnection(ip) {
    const current = ipConnectionMap.get(ip) || 0;
    if (totalConnections >= MAX_WS_CONNECTIONS_TOTAL || current >= MAX_WS_CONNECTIONS_PER_IP) return false;
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
    const clients = rooms.get(key);
    if (!clients) return;
    clients.delete(ws);
    if (clients.size === 0) rooms.delete(key);
  }

  function send(ws, data) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > MAX_WS_BUFFERED_BYTES) {
      ws.close(1013, "client too slow");
      return;
    }
    try {
      ws.send(JSON.stringify(data));
    } catch (_) {
      ws.terminate();
    }
  }

  function broadcast(roomId, data) {
    const clients = rooms.get(String(roomId));
    if (!clients) return;
    for (const ws of clients) send(ws, data);
  }

  function checkRateLimit(userId, text) {
    const now = Date.now();
    const key = String(userId);
    const state = userRateMap.get(key) || {
      lastAt: 0,
      lastText: "",
      lastTextAt: 0,
      times: [],
      lastActivityAt: now
    };

    state.lastActivityAt = now;
    if (state.lastAt && now - state.lastAt < MIN_SEND_INTERVAL_MS) {
      userRateMap.set(key, state);
      return "发言太快了，请稍等几秒再发送。";
    }
    state.times = state.times.filter(time => now - time < BURST_WINDOW_MS);
    if (state.times.length >= MAX_BURST_MESSAGES) {
      userRateMap.set(key, state);
      return "短时间发言过多，请休息一下再聊。";
    }
    if (state.lastText === text && now - state.lastTextAt < REPEAT_WINDOW_MS) {
      userRateMap.set(key, state);
      return "请不要重复发送相同内容。";
    }

    state.lastAt = now;
    state.lastText = text;
    state.lastTextAt = now;
    state.times.push(now);
    userRateMap.set(key, state);
    return "";
  }

  async function authenticate(ws, roomId, token) {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.type !== "user") throw new Error("invalid user token");

    const [[roomRows], [userRows]] = await Promise.all([
      pool.query("SELECT id FROM rooms WHERE id = ? LIMIT 1", [roomId]),
      pool.query("SELECT id, phone, nickname, level, status FROM users WHERE id = ? LIMIT 1", [payload.id])
    ]);
    if (!roomRows.length) throw new Error("room not found");
    if (!userRows.length || userRows[0].status !== "active") throw new Error("user blocked");

    ws.chatUser = userRows[0];
    ws.chatRoomId = roomId;
    ws.authenticated = true;
    addClient(roomId, ws);

    send(ws, {
      type: "ready",
      roomId,
      user: {
        id: ws.chatUser.id,
        nickname: ws.chatUser.nickname || "海鸥用户",
        level: ws.chatUser.level || 0
      }
    });

    const [historyRows] = await pool.query(
      `SELECT id, room_id, user_id, nickname, level, message, created_at FROM chat_messages WHERE room_id = ? AND status = 'normal' ORDER BY id DESC LIMIT ${HISTORY_LIMIT}`,
      [roomId]
    );
    send(ws, { type: "history", messages: historyRows.reverse().map(publicMessage) });
  }

  async function handleMessage(ws, raw) {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch (_) {
      send(ws, { type: "error", error: "消息格式错误" });
      return;
    }

    if (!ws.authenticated) {
      if (data.type !== "auth" || !data.token) {
        send(ws, { type: "error", error: "请先登录" });
        ws.close(1008, "authentication required");
        return;
      }
      try {
        await authenticate(ws, ws.pendingRoomId, String(data.token));
        clearTimeout(ws.authTimer);
      } catch (_) {
        send(ws, { type: "error", error: "登录已过期" });
        ws.close(1008, "authentication failed");
      }
      return;
    }

    if (data.type !== "message") return;
    const text = normalizeText(data.message);
    if (!text) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      send(ws, makeNotice(`消息太长了，请控制在 ${MAX_MESSAGE_LENGTH} 字以内。`));
      return;
    }
    if (hasBlockedContent(text)) {
      send(ws, makeNotice("消息包含不适合发布的内容，已被拦截。"));
      return;
    }

    const rateError = checkRateLimit(ws.chatUser.id, text);
    if (rateError) {
      send(ws, makeNotice(rateError));
      return;
    }

    try {
      const reward = await awardUserExpOnce(
        pool,
        ws.chatUser.id,
        "daily_first_chat",
        beijingDayKey(),
        FIRST_CHAT_EXP_REWARD
      );
      if (reward && reward.level) ws.chatUser.level = reward.level;
    } catch (err) {
      console.error("[ChatWS reward]", err);
    }

    const [result] = await pool.query(
      "INSERT INTO chat_messages (room_id, user_id, nickname, level, message) VALUES (?, ?, ?, ?, ?)",
      [ws.chatRoomId, ws.chatUser.id, ws.chatUser.nickname || "海鸥用户", ws.chatUser.level || 0, text]
    );

    broadcast(ws.chatRoomId, {
      type: "message",
      message: {
        id: result.insertId,
        roomId: ws.chatRoomId,
        userId: ws.chatUser.id,
        nickname: ws.chatUser.nickname || "海鸥用户",
        level: ws.chatUser.level || 0,
        message: text,
        createdAt: new Date().toISOString()
      }
    });
  }

  wss.on("connection", (ws, req) => {
    const ip = getClientIp(req);
    ws.isAlive = true;
    ws.authenticated = false;
    ws.chatRoomId = 0;
    ws.chatUser = null;
    ws.messageQueue = Promise.resolve();

    if (!isOriginAllowed(req)) {
      send(ws, { type: "error", error: "来源未被允许" });
      ws.close(1008, "origin not allowed");
      return;
    }
    if (!trackConnection(ip)) {
      send(ws, { type: "error", error: "聊天室连接过多，请稍后再试。" });
      ws.close(1013, "too many connections");
      return;
    }
    ws.connectionTracked = true;
    ws.on("error", err => console.warn("[ChatWS socket]", err.message));
    ws.on("close", () => {
      clearTimeout(ws.authTimer);
      if (ws.connectionTracked) {
        untrackConnection(ip);
        ws.connectionTracked = false;
      }
      if (ws.chatRoomId) removeClient(ws.chatRoomId, ws);
    });

    let url;
    try {
      url = new URL(req.url, "http://127.0.0.1");
    } catch (_) {
      ws.close(1008, "invalid url");
      return;
    }
    ws.pendingRoomId = Number.parseInt(url.searchParams.get("roomId") || "0", 10);
    if (!Number.isSafeInteger(ws.pendingRoomId) || ws.pendingRoomId <= 0) {
      send(ws, { type: "error", error: "无效的房间" });
      ws.close(1008, "invalid room");
      return;
    }

    ws.authTimer = setTimeout(() => {
      if (!ws.authenticated) {
        send(ws, { type: "error", error: "登录验证超时" });
        ws.close(1008, "authentication timeout");
      }
    }, AUTH_TIMEOUT_MS);
    ws.authTimer.unref();

    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("message", raw => {
      ws.messageQueue = ws.messageQueue
        .then(() => handleMessage(ws, raw))
        .catch(err => {
          console.error("[ChatWS message]", err);
          send(ws, makeNotice("消息发送失败，请稍后再试。"));
        });
    });
  });

  const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch (_) { ws.terminate(); }
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();

  const rateCleanupTimer = setInterval(() => {
    const cutoff = Date.now() - RATE_STATE_TTL_MS;
    for (const [key, state] of userRateMap) {
      if ((state.lastActivityAt || 0) < cutoff) userRateMap.delete(key);
    }
  }, 10 * 60 * 1000);
  rateCleanupTimer.unref();

  wss.on("close", () => {
    clearInterval(heartbeatTimer);
    clearInterval(rateCleanupTimer);
  });

  console.log("[ChatWS] WebSocket ready: /ws/chat");
  return wss;
}

module.exports = setupChatWs;
