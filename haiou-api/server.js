require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const http = require("http");
const app = express();
const PORT = 3001;
const setupChatWs = require("./services/chatWs");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET missing");
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: "4mb" }));

// 处理非法 JSON 请求，避免 body-parser 堆栈刷满 PM2 error.log。
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ ok: false, error: "JSON 格式错误" });
  }
  return next(err);
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306"),
  database: process.env.DB_NAME || "haiou_live",
  user: process.env.DB_USER || "haiou_app",
  password: process.env.DB_PASS || "",
  waitForConnections: true,
  connectionLimit: 10
});

// 挂载公开路由：/api/health, /api/public/rooms 等
app.use("/api", require("./routes/public")(pool));

// 挂载交流群配置：/api/public/community-config, /api/admin/community-config
app.use("/api", require("./routes/communityConfig")(pool));

// 挂载回放封面代理路由：/api/replay-cover
app.use("/api/replay-cover", require("./routes/replayCover"));

// 挂载普通用户认证路由：/api/auth/register, /api/auth/login
app.use("/api/auth", require("./routes/auth")(pool));

// 挂载普通用户路由：/api/user/me
app.use("/api/user", require("./routes/user")(pool));

// 挂载普通用户头像上传：/api/user/avatar
app.use("/api/user/avatar", require("./routes/userAvatar")(pool));

// 挂载普通用户站内信：/api/user/messages
app.use("/api/user/messages", require("./routes/userMessages")(pool));

// 挂载管理员路由：/api/admin/login, /api/admin/me 等
app.use("/api/admin", require("./routes/admin")(pool));

// 挂载主播后台路由：/api/anchor/login, /api/anchor/room, /api/anchor/stream-info
app.use("/api/anchor", require("./routes/anchor")(pool));

// 挂载管理员站内信：/api/admin/site-messages
app.use("/api/admin/site-messages", require("./routes/adminSiteMessages")(pool));

// 挂载回放保存路由：/api/admin/replays
app.use("/api/admin/replays", require("./routes/adminReplays"));

// 挂载回放元数据抓取路由：/api/admin/replay-meta/bilibili
app.use("/api/admin/replay-meta", require("./routes/replayMeta"));

const server = http.createServer(app);
setupChatWs(server, pool);

server.listen(PORT, "127.0.0.1", () => {
  console.log("haiou-api running on http://127.0.0.1:" + PORT);
});
