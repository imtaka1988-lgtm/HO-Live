const express = require("express");
const { fetchOddsRecommendations } = require("../services/odds");

module.exports = function (pool) {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ status: "ok", time: new Date().toISOString(), service: "haiou-api" });
  });

  router.get("/health/db", async (req, res) => {
    try {
      await pool.query("SELECT 1 AS alive");
      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true, db: "ok" });
    } catch (err) {
      return res.status(503).json({ ok: false, error: "db unavailable" });
    }
  });

  router.get("/health/tables", async (req, res) => {
    try {
      await Promise.all([
        pool.query("SELECT 1 FROM rooms LIMIT 1"),
        pool.query("SELECT 1 FROM room_streams LIMIT 1"),
        pool.query("SELECT 1 FROM users LIMIT 1"),
        pool.query("SELECT 1 FROM schema_migrations LIMIT 1")
      ]);
      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true, tables: "ok" });
    } catch (err) {
      return res.status(503).json({ ok: false, error: "tables unavailable" });
    }
  });

  router.get("/public/rooms/:roomId/odds", async (req, res) => {
    try {
      const roomId = String(req.params.roomId || "1").slice(0, 40);
      const data = await fetchOddsRecommendations();
      if (!data || data.games_count === 0) {
        return res.json({ ok: true, room_id: roomId, match_type: "none", title: "", message: "", display: false, games: [] });
      }
      const safeGames = (data.games || []).map(game => ({
        event_id: game.event_id,
        sport_key: game.sport_key,
        sport_title: game.sport_title,
        home_team: game.home_team,
        away_team: game.away_team,
        commence_time: game.commence_time,
        label: "推荐赛事指数",
        bookmaker: game.bookmaker,
        last_update: game.last_update,
        h2h: game.h2h,
        spreads: game.spreads,
        totals: game.totals
      }));
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      return res.json({
        ok: true,
        room_id: roomId,
        match_type: "fallback",
        title: "其他比赛实时指数",
        message: "未匹配到当前直播间比赛，以下为其他赛事数据",
        display: true,
        games: safeGames.slice(0, 8)
      });
    } catch (err) {
      console.error("[public room odds]", err);
      return res.status(502).json({ ok: false, error: "服务暂时不可用" });
    }
  });

  router.get("/public/odds/recommendations", async (req, res) => {
    try {
      const data = await fetchOddsRecommendations();
      if (!data || data.games_count === 0) {
        return res.json({ ok: true, display: false, games: [] });
      }
      const safeGames = (data.games || []).map(game => ({
        event_id: game.event_id,
        sport_key: game.sport_key,
        sport_title: game.sport_title,
        home_team: game.home_team,
        away_team: game.away_team,
        commence_time: game.commence_time,
        bookmaker: game.bookmaker,
        last_update: game.last_update,
        h2h: game.h2h,
        spreads: game.spreads,
        totals: game.totals
      }));
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      return res.json({ ok: true, display: true, games_count: safeGames.length, games: safeGames.slice(0, 8) });
    } catch (err) {
      console.error("[public odds recommendations]", err);
      return res.status(502).json({ ok: false, error: "服务暂时不可用" });
    }
  });

  return router;
};
