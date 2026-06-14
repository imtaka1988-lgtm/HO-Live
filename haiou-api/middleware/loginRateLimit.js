function getClientIp(req) {
  return (
    req.ip ||
    (req.socket && req.socket.remoteAddress) ||
    (req.connection && req.connection.remoteAddress) ||
    "unknown"
  );
}

function cleanIdentity(value) {
  return String(value || "").trim().toLowerCase().slice(0, 80);
}

function createLoginRateLimit(options) {
  const cfg = Object.assign(
    {
      keyPrefix: "login",
      windowMs: 10 * 60 * 1000,
      maxAttempts: 10,
      blockMs: 10 * 60 * 1000,
      identityField: "username"
    },
    options || {}
  );

  const buckets = new Map();

  return function loginRateLimit(req, res, next) {
    const now = Date.now();
    const identity = cleanIdentity(req.body && req.body[cfg.identityField]);
    const ip = getClientIp(req);
    const key = [cfg.keyPrefix, ip, identity || "empty"].join(":");
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + cfg.windowMs, blockedUntil: 0 };
      buckets.set(key, bucket);
    }

    if (bucket.blockedUntil && now < bucket.blockedUntil) {
      const retryAfter = Math.ceil((bucket.blockedUntil - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ ok: false, error: "登录尝试过多，请稍后再试" });
    }

    bucket.count += 1;
    if (bucket.count > cfg.maxAttempts) {
      bucket.blockedUntil = now + cfg.blockMs;
      bucket.resetAt = bucket.blockedUntil + cfg.windowMs;
      const retryAfter = Math.ceil(cfg.blockMs / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ ok: false, error: "登录尝试过多，请稍后再试" });
    }

    if (buckets.size > 2000) {
      for (const [k, v] of buckets) {
        if (now > v.resetAt && (!v.blockedUntil || now > v.blockedUntil)) buckets.delete(k);
        if (buckets.size <= 1500) break;
      }
    }

    next();
  };
}

module.exports = { createLoginRateLimit };
