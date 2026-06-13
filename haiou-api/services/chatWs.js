const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

function safeText(v) {
  return String(v || "").trim().slice(0, 500);
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

  wss.on("connection", async (ws, req) => {
    let roomId = 0;
    let user = null;

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

        const text = safeText(data.message);
        if (!text) return;

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
        send(ws, { type: "error", error: "消息发送失败" });
      }
    });

    ws.on("close", () => {
      if (roomId) removeClient(roomId, ws);
    });
  });

  console.log("[ChatWS] WebSocket ready: /ws/chat");
}

module.exports = setupChatWs;
