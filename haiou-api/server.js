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

app.use("/api/admin", require("./routes/adminRoomCreatePack")(pool));
app.use("/api", require("./routes/public")(pool));
app.use("/api", require("./routes/communityConfig")(pool));
app.use("/api/replay-cover", require("./routes/replayCover"));
app.use("/api/auth", require("./routes/auth")(pool));
app.use("/api/user", require("./routes/user")(pool));
app.use("/api/user/avatar", require("./routes/userAvatar")(pool));
app.use("/api/user/messages", require("./routes/userMessages")(pool));
app.use("/api/admin", require("./routes/adminObsTemplate")(pool));
app.use("/api/admin", require("./routes/adminRoomCreateBundle")(pool));
app.use("/api/admin", require("./routes/adminAnchorBundle")(pool));
app.use("/api/admin", require("./routes/admin")(pool));
app.use("/api/anchor", require("./routes/anchor")(pool));
app.use("/api/anchor/upload", require("./routes/anchorUpload")(pool));
app.use("/api/live/callback", require("./routes/liveCallback")(pool));
app.use("/api/admin/site-messages", require("./routes/adminSiteMessages")(pool));
app.use("/api/admin/replays", require("./routes/adminReplays"));
app.use("/api/admin/replay-meta", require("./routes/replayMeta"));

const server = http.createServer(app);
setupChatWs(server, pool);

server.listen(PORT, "127.0.0.1", () => {
  console.log("haiou-api running on http://127.0.0.1:" + PORT);
});
