const express = require("express");
const { fetchOddsRecommendations } = require("../services/odds");

module.exports = function (pool) {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString(), service: "haiou-api" });
  });

  router.get("/health/db", async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT 1 AS alive, NOW() AS db_time");
      res.json({ ok: true, db: "mysql", db_time: rows[0].db_time });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get("/health/tables", async (req, res) => {
    try {
      const [rooms] = await pool.query("SELECT COUNT(*) AS cnt FROM rooms");
      const [streams] = await pool.query("SELECT COUNT(*) AS cnt FROM room_streams");
      res.json({ ok: true, rooms: rooms[0].cnt, room_streams: streams[0].cnt });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get("/public/rooms", async (req, res) => {
    try {
      const [rooms] = await pool.query(
        "SELECT id, title, category, status, cover, anchor_name AS anchorName, sort_order AS sortOrder, COALESCE(announcement, '') AS announcement FROM rooms ORDER BY sort_order, id"
      );
      for (const r of rooms) {
        const [streams] = await pool.query(
          "SELECT id, name, type, url, is_default AS isDefault, enabled, priority FROM room_streams WHERE room_id = ? AND enabled = 1 AND url != '' ORDER BY priority",
          [r.id]
        );
        r.streams = streams.map(s => ({ ...s, default: s.isDefault === 1, isDefault: undefined }));
      }
      res.json({ ok: true, rooms });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get("/public/rooms/:roomId/odds", async (req, res) => {
    try {
      const roomId = req.params.roomId || "1";
      const data = await fetchOddsRecommendations();
      if (!data || data.games_count === 0) {
        return res.json({ ok: true, room_id: roomId, match_type: "none", title: "", message: "", display: false, games: [] });
      }
      const safeGames = (data.games || []).map(g => ({
        event_id: g.event_id,
        sport_key: g.sport_key,
        sport_title: g.sport_title,
        home_team: g.home_team,
        away_team: g.away_team,
        commence_time: g.commence_time,
        label: "推荐赛事指数",
        bookmaker: g.bookmaker,
        last_update: g.last_update,
        h2h: g.h2h,
        spreads: g.spreads,
        totals: g.totals
      }));
      res.json({
        ok: true,
        room_id: roomId,
        match_type: "fallback",
        title: "其他比赛实时指数",
        message: "未匹配到当前直播间比赛，以下为其他赛事数据",
        display: true,
        games: safeGames.slice(0, 8)
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get("/public/odds/recommendations", async (req, res) => {
    try {
      const data = await fetchOddsRecommendations();
      if (!data || data.games_count === 0) {
        return res.json({ ok: true, display: false, games: [] });
      }
      const safeGames = (data.games || []).map(g => ({
        event_id: g.event_id,
        sport_key: g.sport_key,
        sport_title: g.sport_title,
        home_team: g.home_team,
        away_team: g.away_team,
        commence_time: g.commence_time,
        bookmaker: g.bookmaker,
        last_update: g.last_update,
        h2h: g.h2h,
        spreads: g.spreads,
        totals: g.totals
      }));
      res.json({ ok: true, display: true, games_count: safeGames.length, games: safeGames.slice(0, 8) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
