require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const http = require("http");
const setupChatWs = require("./services/chatWs");
const { createLoginRateLimit } = require("./middleware/loginRateLimit");

const app = express();
const PORT = Number.parseInt(process.env.PORT || "3001", 10) || 3001;
const HOST = process.env.HOST || "127.0.0.1";
const JWT_SECRET = process.env.JWT_SECRET;
const DB_PASS = process.env.DB_PASS;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("JWT_SECRET missing or too short; use at least 32 characters");
  process.exit(1);
}
if (!DB_PASS && process.env.ALLOW_EMPTY_DB_PASS !== "1") {
  console.error("DB_PASS missing. Set DB_PASS or ALLOW_EMPTY_DB_PASS=1 for an intentional empty password.");
  process.exit(1);
}

function buildCorsOptions() {
  const origins = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  if (!origins.length) return null;
  return {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS not allowed"));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 86400
  };
}

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY || "loopback");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

const corsOptions = buildCorsOptions();
if (corsOptions) app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "6mb", strict: true }));

const adminLoginRateLimit = createLoginRateLimit({
  keyPrefix: "admin-login",
  identityField: "username",
  maxAttempts: 8,
  windowMs: 10 * 60 * 1000,
  blockMs: 10 * 60 * 1000
});
const anchorLoginRateLimit = createLoginRateLimit({
  keyPrefix: "anchor-login",
  identityField: "username",
  maxAttempts: 10,
  windowMs: 10 * 60 * 1000,
  blockMs: 10 * 60 * 1000
});
const userLoginRateLimit = createLoginRateLimit({
  keyPrefix: "user-login",
  identityField: "phone",
  maxAttempts: 12,
  windowMs: 10 * 60 * 1000,
  blockMs: 10 * 60 * 1000
});
const userRegisterRateLimit = createLoginRateLimit({
  keyPrefix: "user-register",
  identityField: "phone",
  maxAttempts: 5,
  windowMs: 10 * 60 * 1000,
  blockMs: 30 * 60 * 1000,
  message: "注册操作过于频繁，请稍后再试"
});

app.post("/api/admin/login", adminLoginRateLimit);
app.post("/api/anchor/login", anchorLoginRateLimit);
app.post("/api/auth/login", userLoginRateLimit);
app.post("/api/auth/register", userRegisterRateLimit);

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number.parseInt(process.env.DB_PORT || "3306", 10) || 3306,
  database: process.env.DB_NAME || "haiou_live",
  user: process.env.DB_USER || "haiou_app",
  password: DB_PASS || "",
  waitForConnections: true,
  connectionLimit: Number.parseInt(process.env.DB_POOL_SIZE || "10", 10) || 10,
  maxIdle: Number.parseInt(process.env.DB_POOL_MAX_IDLE || "10", 10) || 10,
  idleTimeout: Number.parseInt(process.env.DB_POOL_IDLE_TIMEOUT || "60000", 10) || 60000,
  queueLimit: Number.parseInt(process.env.DB_QUEUE_LIMIT || "100", 10) || 100,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

app.use("/api/admin", require("./routes/adminRoomCreatePack")(pool));
app.use("/api", require("./routes/publicRoomsById")(pool));
app.use("/api", require("./routes/public")(pool));
app.use("/api", require("./routes/communityConfig")(pool));
app.use("/api/replay-cover", require("./routes/replayCover"));
app.use("/api/auth", require("./routes/auth")(pool));
app.use("/api/user", require("./routes/user")(pool));
app.use("/api/user/avatar", require("./routes/userAvatar")(pool));
app.use("/api/user/messages", require("./routes/userMessages")(pool));
app.use("/api/admin", require("./routes/adminObsTemplate")(pool));
app.use("/api/admin", require("./routes/adminAnchorResetPasswordSecure")(pool));
app.use("/api/admin", require("./routes/adminAnchorBundle")(pool));
app.use("/api/admin", require("./routes/adminRoomListById")(pool));
app.use("/api/admin", require("./routes/adminRoomDeleteCleanup")(pool));
app.use("/api/admin", require("./routes/adminOddsTimeout")());
app.use("/api/admin", require("./routes/adminUsers")(pool));
app.use("/api/admin", require("./routes/admin")(pool));
app.use("/api/anchor", require("./routes/anchor")(pool));
app.use("/api/anchor/upload", require("./routes/anchorUpload")(pool));
app.use("/api/live/callback", require("./routes/liveCallbackKeyGuard")(pool));
app.use("/api/admin/site-messages", require("./routes/adminSiteMessages")(pool));
app.use("/api/admin/replays", require("./routes/adminReplays"));
app.use("/api/admin/replay-meta", require("./routes/replayMeta"));
app.use("/api/articles", require("./routes/publicArticles"));
app.use("/api/schedule", require("./routes/schedule"));

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "接口不存在" });
});
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ ok: false, error: "JSON 格式错误" });
  }
  if (err && err.message === "CORS not allowed") {
    return res.status(403).json({ ok: false, error: "跨域请求未被允许" });
  }
  console.error("[unhandled api error]", err);
  return res.status(500).json({ ok: false, error: "服务器错误" });
});

const server = http.createServer(app);
const chatWs = setupChatWs(server, pool);
server.requestTimeout = Number.parseInt(process.env.HTTP_REQUEST_TIMEOUT_MS || "30000", 10) || 30000;
server.headersTimeout = Number.parseInt(process.env.HTTP_HEADERS_TIMEOUT_MS || "15000", 10) || 15000;
server.keepAliveTimeout = Number.parseInt(process.env.HTTP_KEEPALIVE_TIMEOUT_MS || "5000", 10) || 5000;

const timers = [];
function startNonOverlappingTask(name, fn, intervalMs) {
  let running = false;
  const run = async () => {
    if (running) {
      console.warn(`[task:${name}] skipped because previous run is still active`);
      return;
    }
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[task:${name}]`, err);
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  timers.push(timer);
}

const { warmupCache } = require("./services/dongqiudi");
const { getSchedule } = require("./services/espnSchedule");
startNonOverlappingTask("articles-warmup", warmupCache, 60 * 60 * 1000);
startNonOverlappingTask("schedule-warmup", () => getSchedule(15, { force: true }), 10 * 60 * 1000);

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] received ${signal}`);
  for (const timer of timers) clearInterval(timer);

  if (chatWs && chatWs.clients) {
    for (const client of chatWs.clients) {
      try { client.close(1001, "server shutdown"); } catch (_) { try { client.terminate(); } catch (_) {} }
    }
  }
  if (chatWs && typeof chatWs.close === "function") {
    try { chatWs.close(); } catch (_) {}
  }

  const forceTimer = setTimeout(() => {
    if (chatWs && chatWs.clients) {
      for (const client of chatWs.clients) {
        try { client.terminate(); } catch (_) {}
      }
    }
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  server.close(async () => {
    try { await pool.end(); } catch (err) { console.error("[shutdown db]", err); }
    clearTimeout(forceTimer);
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", err => console.error("[unhandledRejection]", err));
process.on("uncaughtException", err => {
  console.error("[uncaughtException]", err);
  void shutdown("uncaughtException");
});

server.listen(PORT, HOST, () => {
  console.log(`haiou-api running on http://${HOST}:${PORT}`);
});
