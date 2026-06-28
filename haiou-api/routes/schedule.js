/**
 * 赛程 API — GET /api/schedule
 * 数据源：ESPN 公开 API，15 天内赛程，5 分钟缓存
 */
const express = require("express");
const { getSchedule } = require("../services/espnSchedule");

const router = express.Router();

let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000;

router.get("/", async (req, res) => {
  try {
    // 缓存
    if (_cache && Date.now() - _cacheTs < CACHE_TTL) {
      return res.json(_cache);
    }

    const events = await getSchedule(15);

    // 按日期分组
    const byDate = {};
    for (const e of events) {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    }

    // 排序
    const days = Object.keys(byDate).sort();

    // live / scheduled / finished 分类
    const live = events.filter(e =>
      e.status === "STATUS_IN_PROGRESS" || e.status === "STATUS_HALFTIME"
    );
    const today = new Date().toISOString().slice(0, 10);

    const response = {
      ok: true,
      updated: new Date().toISOString(),
      total: events.length,
      live: live.length,
      days: days.map(date => ({
        date,
        count: byDate[date].length,
        isToday: date === today,
        matches: byDate[date].map(e => ({
          league: e.league,
          home: e.home,
          away: e.away,
          time: e.time,
          status: e.status,
          statusDesc: e.statusDesc,
          detail: e.detail,
        })),
      })),
    };

    _cache = response;
    _cacheTs = Date.now();
    res.json(response);
  } catch (err) {
    console.error("[api error]", err);
    res.status(500).json({ ok: false, error: "获取赛程失败" });
  }
});

module.exports = router;
