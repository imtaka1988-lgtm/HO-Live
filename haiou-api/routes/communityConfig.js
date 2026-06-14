const express = require("express");
const authMiddleware = require("../middleware/auth");

let tableReady = false;
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

async function ensureTable(pool) {
  if (tableReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS site_settings (setting_key VARCHAR(80) NOT NULL PRIMARY KEY, setting_value MEDIUMTEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  tableReady = true;
}

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function cleanBool(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return !!value;
}

function normalizeConfig(input) {
  const src = input && typeof input === "object" ? input : {};
  return {
    app: {
      enabled: cleanBool(src.app && src.app.enabled, DEFAULT_CONFIG.app.enabled),
      tag: cleanText(src.app && src.app.tag, 20) || DEFAULT_CONFIG.app.tag,
      title: cleanText(src.app && src.app.title, 60) || DEFAULT_CONFIG.app.title,
      desc: cleanText(src.app && src.app.desc, 220) || DEFAULT_CONFIG.app.desc,
      qrImage: cleanText(src.app && src.app.qrImage, 255) || DEFAULT_CONFIG.app.qrImage,
      customerId: cleanText(src.app && src.app.customerId, 80) || DEFAULT_CONFIG.app.customerId,
      groupId: cleanText(src.app && src.app.groupId, 80) || DEFAULT_CONFIG.app.groupId,
      buttonText: cleanText(src.app && src.app.buttonText, 40) || DEFAULT_CONFIG.app.buttonText,
      buttonLink: cleanText(src.app && src.app.buttonLink, 255) || DEFAULT_CONFIG.app.buttonLink
    },
    wechat: {
      enabled: cleanBool(src.wechat && src.wechat.enabled, DEFAULT_CONFIG.wechat.enabled),
      tag: cleanText(src.wechat && src.wechat.tag, 20) || DEFAULT_CONFIG.wechat.tag,
      title: cleanText(src.wechat && src.wechat.title, 60) || DEFAULT_CONFIG.wechat.title,
      desc: cleanText(src.wechat && src.wechat.desc, 220) || DEFAULT_CONFIG.wechat.desc,
      serviceQrImage: cleanText(src.wechat && src.wechat.serviceQrImage, 255) || DEFAULT_CONFIG.wechat.serviceQrImage,
      groupQrImage: cleanText(src.wechat && src.wechat.groupQrImage, 255) || DEFAULT_CONFIG.wechat.groupQrImage,
      serviceId: cleanText(src.wechat && src.wechat.serviceId, 80) || DEFAULT_CONFIG.wechat.serviceId,
      groupId: cleanText(src.wechat && src.wechat.groupId, 80) || DEFAULT_CONFIG.wechat.groupId
    },
    official: {
      enabled: cleanBool(src.official && src.official.enabled, DEFAULT_CONFIG.official.enabled),
      tag: cleanText(src.official && src.official.tag, 20) || DEFAULT_CONFIG.official.tag,
      title: cleanText(src.official && src.official.title, 60) || DEFAULT_CONFIG.official.title,
      desc: cleanText(src.official && src.official.desc, 220) || DEFAULT_CONFIG.official.desc,
      qrImage: cleanText(src.official && src.official.qrImage, 255) || DEFAULT_CONFIG.official.qrImage,
      accountName: cleanText(src.official && src.official.accountName, 80) || DEFAULT_CONFIG.official.accountName,
      pushText: cleanText(src.official && src.official.pushText, 120) || DEFAULT_CONFIG.official.pushText
    }
  };
}

async function getConfig(pool) {
  await ensureTable(pool);
  const [rows] = await pool.query("SELECT setting_value FROM site_settings WHERE setting_key = ?", [SETTING_KEY]);
  if (!rows.length) return DEFAULT_CONFIG;
  try {
    return normalizeConfig(JSON.parse(rows[0].setting_value || "{}"));
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

async function saveConfig(pool, config) {
  await ensureTable(pool);
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
      const config = await getConfig(pool);
      res.json({ ok: true, config });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get("/admin/community-config", authMiddleware, async (req, res) => {
    try {
      const config = await getConfig(pool);
      res.json({ ok: true, config });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.put("/admin/community-config", authMiddleware, async (req, res) => {
    try {
      const config = await saveConfig(pool, req.body && req.body.config ? req.body.config : req.body);
      res.json({ ok: true, config });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
