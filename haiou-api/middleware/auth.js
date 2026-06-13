const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!t) return res.status(401).json({ ok: false, error: "未登录" });
  try {
    req.admin = jwt.verify(t, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "登录已过期" });
  }
}

module.exports = authMiddleware;
