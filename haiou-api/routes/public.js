const express = require("express");
const { fetchOddsRecommendations } = require("../services/odds");
const authMiddleware = require("../middleware/auth");

function pickSmallestMissingRoomId(rows) {
  let nextId = 1;
  for (const row of rows) {
    const id = Number(row.id);
    if (id === nextId) nextId += 1;
    else if (id > nextId) break;
  }
  return nextId;
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString(), service: "haiou-api" });
  });

  router.get("/health/db", async (req, res) => {
    try {
      await pool.query("SELECT 1 AS alive");
      res.json({ ok: true, db: "ok" });
    } catch (err) {
      res.status(500).json({ ok: false, error: "db unavailable" });
    }
  });

  router.get("/health/tables", async (req, res) => {
    try {
      await pool.query("SELECT 1 FROM rooms LIMIT 1");
      await pool.query("SELECT 1 FROM room_streams LIMIT 1");
      res.json({ ok: true, tables: "ok" });
    } catch (err) {
      res.status(500).json({ ok: false, error: "tables unavailable" });
    }
  });

  router.post("/admin/rooms", authMiddleware, async (req, res) => {
    try {
      const title = (req.body.title || "新直播间").trim();
      const category = req.body.category || "football";
      const status = req.body.status || "offline";
      const cover = req.body.cover || "";
      const anchorName = req.body.anchor_name || req.body.anchorName || "";
      const announcement = req.body.announcement || "";
      const sortOrder = parseInt(req.body.sort_order || req.body.sortOrder || 0, 10) || 0;

      if (!["football", "basketball", "analysis"].includes(category)) {
        return res.status(400).json({ ok: false, error: "无效的分类" });
      }
      if (!["live", "offline", "pending"].includes(status)) {
        return res.status(400).json({ ok: false, error: "无效的状态" });
      }

      const [ids] = await pool.query("SELECT id FROM rooms ORDER BY id ASC");
      const roomId = pickSmallestMissingRoomId(ids);

      await pool.query(
        "INSERT INTO rooms (id, title, category, status, cover, anchor_name, announcement, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [roomId, title, category, status, cover, anchorName, announcement, sortOrder]
      );

      res.json({
        ok: true,
        room: { id: roomId, title, category, status, cover, anchorName, announcement, sortOrder }
      });
    } catch (err) {
      console.error("[api error]", err);
      res.status(500).json({ ok: false, error: "服务器错误" });
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
      console.error("[public room odds]", err);
      res.status(500).json({ ok: false, error: "服务暂时不可用" });
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
      console.error("[public odds recommendations]", err);
      res.status(500).json({ ok: false, error: "服务暂时不可用" });
    }
  });

  return router;
};
