const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const DATA_FILE = path.resolve(__dirname, "../../haiou-live/assets/data/replays.local.json");
const DATA_DIR = path.dirname(DATA_FILE);
const MAX_REPLAYS = 2000;
let mutationQueue = Promise.resolve();

function cleanText(value, maxLength = 200) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function extractBvid(value) {
  const match = String(value || "").match(/BV[0-9A-Za-z]{10,20}/);
  return match ? match[0] : "";
}

function normalizeHttpsUrl(value, allowedHosts) {
  const raw = cleanText(value, 1000);
  if (!raw) return "";
  try {
    const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (parsed.protocol !== "https:") return "";
    if (allowedHosts && !allowedHosts.has(parsed.hostname.toLowerCase())) return "";
    return parsed.toString();
  } catch (_) {
    return "";
  }
}

async function readList() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const json = JSON.parse(raw || "[]");
    return Array.isArray(json) ? json.slice(0, MAX_REPLAYS) : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeListAtomic(list) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = path.join(DATA_DIR, `.replays.${process.pid}.${crypto.randomUUID()}.tmp`);
  const payload = `${JSON.stringify(list.slice(0, MAX_REPLAYS), null, 2)}\n`;
  try {
    await fs.writeFile(tempFile, payload, { encoding: "utf8", mode: 0o640, flag: "wx" });
    await fs.rename(tempFile, DATA_FILE);
  } catch (error) {
    try { await fs.unlink(tempFile); } catch (_) {}
    throw error;
  }
}

function enqueueMutation(operation) {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.catch(() => {});
  return result;
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, Number.parseInt(item.id || 0, 10) || 0), 100) + 1;
}

function normalizeReplay(body, list) {
  const title = cleanText(body.title, 160);
  const suppliedUrl = normalizeHttpsUrl(body.url, new Set(["www.bilibili.com", "bilibili.com"]));
  const embedUrl = normalizeHttpsUrl(body.embedUrl, new Set(["player.bilibili.com"]));
  const bvid = extractBvid(suppliedUrl) || extractBvid(embedUrl);

  if (!title) throw new Error("标题不能为空");
  if (!bvid) throw new Error("未识别到 B站 BV 号");
  if (!embedUrl) throw new Error("播放地址不正确");

  const sport = body.sport === "basketball" ? "basketball" : "football";
  const tag = cleanText(body.tag, 40) || (sport === "basketball" ? "篮球" : "足球");
  const year = cleanText(body.year, 20) || "经典";
  const desc = cleanText(body.desc, 500) || title;
  const sortValue = Number.parseInt(body.sort, 10);
  const cover = normalizeHttpsUrl(body.cover) || cleanText(body.cover, 500);

  return {
    id: nextId(list),
    title,
    sport,
    tag,
    year,
    cover,
    desc,
    url: `https://www.bilibili.com/video/${bvid}/`,
    sourceType: "bilibili",
    platform: "bilibili",
    embedUrl,
    status: "观看回顾",
    sort: Number.isFinite(sortValue) ? Math.max(-9999, Math.min(sortValue, 9999)) : 0
  };
}

router.get("/", authMiddleware, async (req, res) => {
  try {
    const list = await readList();
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, replays: list, count: list.length });
  } catch (error) {
    console.error("[admin replays list]", error);
    return res.status(500).json({ ok: false, error: "回放列表读取失败" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const result = await enqueueMutation(async () => {
      const list = await readList();
      const replay = normalizeReplay(req.body || {}, list);
      const bvid = extractBvid(replay.url);
      const existingIndex = list.findIndex(item =>
        extractBvid(item.url) === bvid || extractBvid(item.embedUrl) === bvid
      );

      let action = "created";
      if (existingIndex >= 0) {
        replay.id = list[existingIndex].id;
        list[existingIndex] = replay;
        action = "updated";
      } else {
        list.unshift(replay);
      }
      await writeListAtomic(list);
      return { action, replay, count: list.length };
    });
    return res.status(result.action === "created" ? 201 : 200).json({ ok: true, ...result });
  } catch (error) {
    console.error("[admin replay save]", error);
    const isValidation = /标题|BV|播放地址/.test(error.message || "");
    return res.status(isValidation ? 400 : 500).json({
      ok: false,
      error: isValidation ? error.message : "保存失败"
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: "回放 ID 不正确" });
  }

  try {
    const result = await enqueueMutation(async () => {
      const list = await readList();
      const next = list.filter(item => Number.parseInt(item.id, 10) !== id);
      if (next.length === list.length) return null;
      await writeListAtomic(next);
      return { deletedId: id, count: next.length };
    });
    if (!result) return res.status(404).json({ ok: false, error: "没有找到该回放" });
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[admin replay delete]", error);
    return res.status(500).json({ ok: false, error: "删除失败" });
  }
});

module.exports = router;
