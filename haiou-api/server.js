require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const http = require("http");
const app = express();
const PORT = 3001;
const setupChatWs = require("./services/chatWs");
const { createLoginRateLimit } = require("./middleware/loginRateLimit");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET missing");
  process.exit(1);
}

const DB_PASS = process.env.DB_PASS;
if (!DB_PASS && process.env.ALLOW_EMPTY_DB_PASS !== "1") {
  console.error("DB_PASS missing. Set DB_PASS or set ALLOW_EMPTY_DB_PASS=1 if the database intentionally uses an empty password.");
  process.exit(1);
}

function buildCorsOptions() {
  const origins = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

  if (!origins.length) return null;

  return {
    origin(origin, cb) {
      if (!origin || origins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS not allowed"));
    }
  };
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

const corsOptions = buildCorsOptions();
app.use(corsOptions ? cors(corsOptions) : cors());
app.use(express.json({ limit: "4mb" }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ ok: false, error: "JSON 格式错误" });
  }
  return next(err);
});

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
  port: parseInt(process.env.DB_PORT || "3306"),
  database: process.env.DB_NAME || "haiou_live",
  user: process.env.DB_USER || "haiou_app",
  password: DB_PASS || "",
  waitForConnections: true,
  connectionLimit: 10
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
app.use("/api/admin", require("./routes/admin")(pool));
app.use("/api/anchor", require("./routes/anchor")(pool));
app.use("/api/anchor/upload", require("./routes/anchorUpload")(pool));
app.use("/api/live/callback", require("./routes/liveCallbackKeyGuard")(pool));
app.use("/api/live/callback", require("./routes/liveCallback")(pool));
app.use("/api/admin/site-messages", require("./routes/adminSiteMessages")(pool));
app.use("/api/admin/replays", require("./routes/adminReplays"));
app.use("/api/admin/replay-meta", require("./routes/replayMeta"));

const server = http.createServer(app);
setupChatWs(server, pool);

server.listen(PORT, "127.0.0.1", () => {
  console.log("haiou-api running on http://127.0.0.1:" + PORT);
});
