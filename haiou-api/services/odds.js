const https = require("https");

const REC_SPORTS = ["basketball_nba", "basketball_wnba", "basketball_nbl"];
const REC_REGIONS = "au,us";
const REC_MARKETS = "h2h,spreads,totals";

const recCache = {};

function pickGame(g) {
  const bm = g.bookmakers || [];
  const fb = bm[0];
  const h2h = fb && fb.markets ? (fb.markets.find(m => m.key === "h2h") || {}).outcomes || null : null;
  const sp = fb && fb.markets ? (fb.markets.find(m => m.key === "spreads") || {}).outcomes || null : null;
  const to = fb && fb.markets ? (fb.markets.find(m => m.key === "totals") || {}).outcomes || null : null;
  return {
    event_id: g.id,
    sport_key: g.sport_key,
    sport_title: g.sport_title || g.sport_key,
    home_team: g.home_team,
    away_team: g.away_team,
    commence_time: g.commence_time,
    bookmaker: fb ? fb.title : "",
    last_update: fb ? fb.last_update : "",
    h2h: h2h ? h2h.map(o => ({ name: o.name, price: o.price })) : [],
    spreads: sp ? sp.map(o => ({ name: o.name, price: o.price, point: o.point })) : [],
    totals: to ? to.map(o => ({ name: o.name, price: o.price, point: o.point })) : []
  };
}

function sortGames(games) {
  const now = Date.now();
  return games.sort((a, b) => {
    const da = (a.h2h.length + a.spreads.length + a.totals.length);
    const db = (b.h2h.length + b.spreads.length + b.totals.length);
    if (db !== da) return db - da;
    const ta = a.commence_time ? new Date(a.commence_time).getTime() : 0;
    const tb = b.commence_time ? new Date(b.commence_time).getTime() : 0;
    return Math.abs(ta - now) - Math.abs(tb - now);
  });
}

async function fetchOddsRecommendations() {
  const now = Date.now();
  if (recCache.data && (now - recCache.ts) < 300000) {
    recCache.data.cached = true;
    return recCache.data;
  }
  const k = process.env.ODDS_API_KEY;
  if (!k) return null;
  let allGames = [];
  let remaining = null;
  let used = null;
  for (const sport of REC_SPORTS) {
    try {
      const url = "https://api.the-odds-api.com/v4/sports/" + sport + "/odds?regions=" + REC_REGIONS + "&markets=" + REC_MARKETS + "&oddsFormat=decimal&apiKey=" + k;
      const data = await new Promise((resolve) => {
        https.get(url, (apiRes) => {
          let body = "";
          apiRes.on("data", ch => body += ch);
          apiRes.on("end", () => {
            if (!remaining) remaining = apiRes.headers["x-requests-remaining"];
            if (!used) used = apiRes.headers["x-requests-used"];
            try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
          });
        }).on("error", () => resolve(null));
      });
      if (Array.isArray(data) && data.length > 0) allGames = allGames.concat(data.map(pickGame));
    } catch (e) { /* skip failed sport */ }
  }
  const sorted = sortGames(allGames).slice(0, 8);
  const result = {
    ok: true,
    games_count: sorted.length,
    games: sorted,
    requests_remaining: remaining,
    requests_used: used,
    cached: false,
    message: sorted.length === 0 ? "暂无可展示指数" : ""
  };
  recCache.data = result;
  recCache.ts = now;
  return result;
}

module.exports = {
  REC_SPORTS,
  REC_REGIONS,
  REC_MARKETS,
  recCache,
  pickGame,
  sortGames,
  fetchOddsRecommendations
};
