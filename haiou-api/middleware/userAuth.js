const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

function userAuthMiddleware(req, res, next) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!t) return res.status(401).json({ ok: false, error: "未登录" });

  try {
    const payload = jwt.verify(t, JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.type !== "user") {
      return res.status(403).json({ ok: false, error: "用户身份无效" });
    }
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "登录已过期" });
  }
}

module.exports = userAuthMiddleware;
