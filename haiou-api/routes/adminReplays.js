const express = require("express");
const fs = require("fs");
const path = require("path");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const DATA_FILE = path.resolve(__dirname, "../../haiou-live/assets/data/replays.local.json");
const DATA_DIR = path.dirname(DATA_FILE);

function readList() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const json = JSON.parse(raw || "[]");
    return Array.isArray(json) ? json : [];
  } catch (e) {
    return [];
  }
}

function writeList(list) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2) + "\n", "utf8");
}

function cleanText(value, maxLen) {
  return String(value || "").trim().slice(0, maxLen || 200);
}

function normalizeCover(value) {
  const url = cleanText(value, 500);
  if (url.startsWith("http://")) return "https://" + url.slice(7);
  return url;
}

function extractBvid(value) {
  const m = String(value || "").match(/BV[0-9A-Za-z]+/);
  return m ? m[0] : "";
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, parseInt(item.id || 0, 10) || 0), 100) + 1;
}

function normalizeReplay(body, list) {
  const title = cleanText(body.title, 160);
  const url = cleanText(body.url, 500);
  const embedUrl = cleanText(body.embedUrl, 800);
  const bvid = extractBvid(url) || extractBvid(embedUrl);
  if (!title) throw new Error("标题不能为空");
  if (!bvid) throw new Error("未识别到 B站 BV 号");
  if (!embedUrl || !embedUrl.includes("player.bilibili.com")) throw new Error("播放地址不正确");

  const sport = body.sport === "basketball" ? "basketball" : "football";
  const tag = cleanText(body.tag, 40) || (sport === "basketball" ? "篮球" : "足球");
  const year = cleanText(body.year, 20) || "经典";
  const desc = cleanText(body.desc, 260) || title;
  const sort = parseInt(body.sort, 10);

  return {
    id: nextId(list),
    title,
    sport,
    tag,
    year,
    cover: normalizeCover(body.cover),
    desc,
    url: "https://www.bilibili.com/video/" + bvid + "/",
    sourceType: "bilibili",
    platform: "bilibili",
    embedUrl,
    status: "观看回顾",
    sort: Number.isFinite(sort) ? sort : 0
  };
}

router.post("/", authMiddleware, (req, res) => {
  try {
    const list = readList();
    const replay = normalizeReplay(req.body || {}, list);
    const bvid = extractBvid(replay.url);
    const existingIndex = list.findIndex(item => extractBvid(item.url) === bvid || extractBvid(item.embedUrl) === bvid);

    let action = "created";
    if (existingIndex >= 0) {
      replay.id = list[existingIndex].id;
      list[existingIndex] = replay;
      action = "updated";
    } else {
      list.unshift(replay);
    }

    writeList(list);
    res.json({ ok: true, action, replay, count: list.length });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || "保存失败" });
  }
});

module.exports = router;
