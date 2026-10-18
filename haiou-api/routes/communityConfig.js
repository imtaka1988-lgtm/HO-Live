const express = require("express");
const authMiddleware = require("../middleware/auth");

const SETTING_KEY = "community_config";
const DEFAULT_CONFIG = {
  app: {
    enabled: true,
    tag: "主推",
    title: "海鸥球迷交流 App",
    desc: "下载海鸥球迷交流 App，获取直播提醒、赛事回放更新和球迷讨论入口。",
    qrImage: "/assets/icons/app-icon.svg",
    customerId: "HAIOU2026",
    groupId: "HAIOU-888888",
    buttonText: "立即进入交流区",
    buttonLink: "/pages/app.html"
  },
  wechat: {
    enabled: true,
    tag: "微信",
    title: "海鸥微信客服 / 赛事群",
    desc: "添加微信客服后备注“海鸥直播”，管理员会邀请进入对应赛事交流群。",
    serviceQrImage: "/assets/img/avatar-default.svg",
    groupQrImage: "/assets/img/thumb-1.svg",
    serviceId: "haiou2026",
    groupId: "海鸥赛事交流群 01"
  },
  official: {
    enabled: true,
    tag: "公众号",
    title: "海鸥直播情报站",
    desc: "关注公众号，接收直播入口、赛前提醒、赛事分析和经典回放更新。",
    qrImage: "/assets/img/thumb-2.svg",
    accountName: "海鸥直播助手",
    pushText: "直播提醒 / 赛事分析 / 回放更新"
  }
};

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function cleanBool(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function normalizeConfig(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    app: {
      enabled: cleanBool(source.app && source.app.enabled, DEFAULT_CONFIG.app.enabled),
      tag: cleanText(source.app && source.app.tag, 20) || DEFAULT_CONFIG.app.tag,
      title: cleanText(source.app && source.app.title, 60) || DEFAULT_CONFIG.app.title,
      desc: cleanText(source.app && source.app.desc, 220) || DEFAULT_CONFIG.app.desc,
      qrImage: cleanText(source.app && source.app.qrImage, 255) || DEFAULT_CONFIG.app.qrImage,
      customerId: cleanText(source.app && source.app.customerId, 80) || DEFAULT_CONFIG.app.customerId,
      groupId: cleanText(source.app && source.app.groupId, 80) || DEFAULT_CONFIG.app.groupId,
      buttonText: cleanText(source.app && source.app.buttonText, 40) || DEFAULT_CONFIG.app.buttonText,
      buttonLink: cleanText(source.app && source.app.buttonLink, 255) || DEFAULT_CONFIG.app.buttonLink
    },
    wechat: {
      enabled: cleanBool(source.wechat && source.wechat.enabled, DEFAULT_CONFIG.wechat.enabled),
      tag: cleanText(source.wechat && source.wechat.tag, 20) || DEFAULT_CONFIG.wechat.tag,
      title: cleanText(source.wechat && source.wechat.title, 60) || DEFAULT_CONFIG.wechat.title,
      desc: cleanText(source.wechat && source.wechat.desc, 220) || DEFAULT_CONFIG.wechat.desc,
      serviceQrImage: cleanText(source.wechat && source.wechat.serviceQrImage, 255) || DEFAULT_CONFIG.wechat.serviceQrImage,
      groupQrImage: cleanText(source.wechat && source.wechat.groupQrImage, 255) || DEFAULT_CONFIG.wechat.groupQrImage,
      serviceId: cleanText(source.wechat && source.wechat.serviceId, 80) || DEFAULT_CONFIG.wechat.serviceId,
      groupId: cleanText(source.wechat && source.wechat.groupId, 80) || DEFAULT_CONFIG.wechat.groupId
    },
    official: {
      enabled: cleanBool(source.official && source.official.enabled, DEFAULT_CONFIG.official.enabled),
      tag: cleanText(source.official && source.official.tag, 20) || DEFAULT_CONFIG.official.tag,
      title: cleanText(source.official && source.official.title, 60) || DEFAULT_CONFIG.official.title,
      desc: cleanText(source.official && source.official.desc, 220) || DEFAULT_CONFIG.official.desc,
      qrImage: cleanText(source.official && source.official.qrImage, 255) || DEFAULT_CONFIG.official.qrImage,
      accountName: cleanText(source.official && source.official.accountName, 80) || DEFAULT_CONFIG.official.accountName,
      pushText: cleanText(source.official && source.official.pushText, 120) || DEFAULT_CONFIG.official.pushText
    }
  };
}

async function getConfig(pool) {
  const [rows] = await pool.query(
    "SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1",
    [SETTING_KEY]
  );
  if (!rows.length) return DEFAULT_CONFIG;
  try {
    return normalizeConfig(JSON.parse(rows[0].setting_value || "{}"));
  } catch (_) {
    return DEFAULT_CONFIG;
  }
}

async function saveConfig(pool, config) {
  const normalized = normalizeConfig(config);
  await pool.query(
    "INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
    [SETTING_KEY, JSON.stringify(normalized)]
  );
  return normalized;
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/public/community-config", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return res.json({ ok: true, config: await getConfig(pool) });
    } catch (err) {
      console.error("[community config public]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.get("/admin/community-config", authMiddleware, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true, config: await getConfig(pool) });
    } catch (err) {
      console.error("[community config admin get]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.put("/admin/community-config", authMiddleware, async (req, res) => {
    try {
      const input = req.body && req.body.config ? req.body.config : req.body;
      return res.json({ ok: true, config: await saveConfig(pool, input) });
    } catch (err) {
      console.error("[community config admin update]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
