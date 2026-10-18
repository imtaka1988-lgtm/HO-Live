const express = require("express");
const { getSchedule, beijingToday } = require("../services/espnSchedule");

const router = express.Router();
const LIVE_STATUSES = new Set([
  "STATUS_IN_PROGRESS",
  "STATUS_HALFTIME",
  "STATUS_END_PERIOD",
  "STATUS_DELAYED"
]);

router.get("/", async (req, res) => {
  try {
    const requestedDays = Number.parseInt(req.query.days || "15", 10);
    const daysToLoad = Math.max(1, Math.min(requestedDays || 15, 30));
    const events = await getSchedule(daysToLoad);
    const byDate = new Map();

    for (const event of events) {
      if (!byDate.has(event.date)) byDate.set(event.date, []);
      byDate.get(event.date).push(event);
    }

    const today = beijingToday();
    const days = [...byDate.keys()].sort().map(date => {
      const matches = byDate.get(date).sort((a, b) => a.time.localeCompare(b.time));
      return {
        date,
        count: matches.length,
        isToday: date === today,
        matches: matches.map(event => ({
          id: event.id,
          sport: event.sport,
          league: event.league,
          home: event.home,
          away: event.away,
          homeScore: event.homeScore,
          awayScore: event.awayScore,
          time: event.time,
          status: event.status,
          statusDesc: event.statusDesc,
          detail: event.detail,
          venue: event.venue
        }))
      };
    });

    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return res.json({
      ok: true,
      updated: new Date().toISOString(),
      timezone: "Asia/Shanghai",
      total: events.length,
      live: events.filter(event => LIVE_STATUSES.has(event.status)).length,
      days
    });
  } catch (err) {
    console.error("[schedule api]", err);
    return res.status(502).json({ ok: false, error: "获取赛程失败" });
  }
});

module.exports = router;
