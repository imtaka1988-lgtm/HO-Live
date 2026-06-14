const express = require("express");
const authMiddleware = require("../middleware/auth");
const { fetchJson } = require("../services/odds");

function oddsApiKey(res) {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    res.status(500).json({ ok: false, error: "ODDS_API_KEY 未配置" });
    return "";
  }
  return key;
}

module.exports = function () {
  const router = express.Router();

  router.get("/odds/health", authMiddleware, async (req, res) => {
    try {
      const key = oddsApiKey(res);
      if (!key) return;

      const result = await fetchJson("https://api.the-odds-api.com/v4/sports?apiKey=" + key);
      const data = result && result.data;
      if (!Array.isArray(data)) return res.status(504).json({ ok: false, error: "Odds API 请求超时或响应异常" });

      const keys = data.map(s => s.key);
      res.json({
        ok: true,
        sports_count: keys.length,
        sample_keys: keys.slice(0, 10),
        football_keys: keys.filter(x => x.includes("soccer") || x.includes("football")).slice(0, 5),
        basketball_keys: keys.filter(x => x.includes("basketball")).slice(0, 5),
        requests_remaining: result.headers && result.headers["x-requests-remaining"]
      });
    } catch (err) {
      console.error("[admin odds health]", err);
      res.status(500).json({ ok: false, error: "Odds API 请求失败" });
    }
  });

  router.get("/odds/sports", authMiddleware, async (req, res) => {
    try {
      const key = oddsApiKey(res);
      if (!key) return;

      const result = await fetchJson("https://api.the-odds-api.com/v4/sports?apiKey=" + key);
      const data = result && result.data;
      if (!Array.isArray(data)) return res.status(504).json({ ok: false, error: "Odds API 请求超时或响应异常" });

      const soccer = data.filter(s => s.group === "Soccer");
      const basketball = data.filter(s => s.group === "Basketball");
      const pick = s => ({ key: s.key, group: s.group, title: s.title, description: s.description || "", active: s.active });
      res.json({
        ok: true,
        total_sports: data.length,
        soccer: { count: soccer.length, sports: soccer.map(pick) },
        basketball: { count: basketball.length, sports: basketball.map(pick) }
      });
    } catch (err) {
      console.error("[admin odds sports]", err);
      res.status(500).json({ ok: false, error: "Odds API 请求失败" });
    }
  });

  return router;
};
