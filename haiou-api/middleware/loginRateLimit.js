function getClientIp(req) {
  return String(
    req.ip ||
    (req.socket && req.socket.remoteAddress) ||
    (req.connection && req.connection.remoteAddress) ||
    "unknown"
  ).slice(0, 120);
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
      ipMaxAttempts: 50,
      blockMs: 10 * 60 * 1000,
      identityField: "username",
      message: "登录尝试过多，请稍后再试"
    },
    options || {}
  );

  const buckets = new Map();
  let lastCleanupAt = 0;

  function cleanExpired(now) {
    if (now - lastCleanupAt < 60 * 1000 && buckets.size < 5000) return;
    lastCleanupAt = now;
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt && now > bucket.blockedUntil) buckets.delete(key);
    }
    if (buckets.size > 10000) {
      const oldest = [...buckets.entries()]
        .sort((a, b) => a[1].lastAt - b[1].lastAt)
        .slice(0, buckets.size - 7500);
      for (const [key] of oldest) buckets.delete(key);
    }
  }

  function consume(key, maxAttempts, now) {
    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + cfg.windowMs, blockedUntil: 0, lastAt: now };
      buckets.set(key, bucket);
    }

    bucket.lastAt = now;
    if (bucket.blockedUntil && now < bucket.blockedUntil) return bucket;
    bucket.count += 1;
    if (bucket.count > maxAttempts) {
      bucket.blockedUntil = now + cfg.blockMs;
      bucket.resetAt = bucket.blockedUntil + cfg.windowMs;
    }
    return bucket;
  }

  return function loginRateLimit(req, res, next) {
    const now = Date.now();
    cleanExpired(now);

    const identity = cleanIdentity(req.body && req.body[cfg.identityField]);
    const ip = getClientIp(req);
    const identityKey = `${cfg.keyPrefix}:identity:${identity || "empty"}`;
    const ipKey = `${cfg.keyPrefix}:ip:${ip}`;
    const identityBucket = consume(identityKey, cfg.maxAttempts, now);
    const ipBucket = consume(ipKey, cfg.ipMaxAttempts, now);
    const blockedUntil = Math.max(identityBucket.blockedUntil || 0, ipBucket.blockedUntil || 0);

    if (blockedUntil > now) {
      const retryAfter = Math.ceil((blockedUntil - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ ok: false, error: cfg.message });
    }

    res.once("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        buckets.delete(identityKey);
      }
    });

    return next();
  };
}

module.exports = { createLoginRateLimit };
