const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

function anchorAuthMiddleware(req, res, next) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!t) return res.status(401).json({ ok: false, error: "未登录" });

  try {
    const payload = jwt.verify(t, JWT_SECRET);
    if (payload.type !== "anchor") {
      return res.status(401).json({ ok: false, error: "主播身份无效" });
    }
    req.anchor = payload;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "登录已过期" });
  }
}

module.exports = anchorAuthMiddleware;
