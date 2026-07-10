const https = require("https");

const REC_SPORTS = ["basketball_nba", "basketball_wnba", "basketball_nbl"];
const REC_REGIONS = "au,us";
const REC_MARKETS = "h2h,spreads,totals";
const ODDS_API_TIMEOUT_MS = Number.parseInt(process.env.ODDS_API_TIMEOUT_MS || "5000", 10) || 5000;
const ODDS_CACHE_TTL_MS = Number.parseInt(process.env.ODDS_CACHE_TTL_MS || "300000", 10) || 300000;
const ODDS_MAX_RESPONSE_BYTES = Number.parseInt(process.env.ODDS_MAX_RESPONSE_BYTES || "4194304", 10) || 4194304;
const agent = new https.Agent({ keepAlive: true, maxSockets: 6, timeout: ODDS_API_TIMEOUT_MS });
const recCache = { data: null, ts: 0, inFlight: null };

function fetchJson(url) {
  return new Promise(resolve => {
    let completed = false;
    const finish = value => {
      if (completed) return;
      completed = true;
      resolve(value);
    };

    const request = https.get(url, {
      agent,
      timeout: ODDS_API_TIMEOUT_MS,
      headers: { Accept: "application/json", "User-Agent": "HO-Live/1.0" }
    }, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        finish(null);
        return;
      }
      let body = "";
      let size = 0;
      response.on("data", chunk => {
        size += chunk.length;
        if (size > ODDS_MAX_RESPONSE_BYTES) {
          request.destroy(new Error("odds response too large"));
          return;
        }
        body += chunk;
      });
      response.on("end", () => {
        try { finish({ data: JSON.parse(body), headers: response.headers }); }
        catch (_) { finish(null); }
      });
    });
    request.on("timeout", () => request.destroy(new Error("odds request timeout")));
    request.on("error", () => finish(null));
  });
}

function pickGame(game) {
  const bookmaker = Array.isArray(game.bookmakers) ? game.bookmakers[0] : null;
  const markets = bookmaker && Array.isArray(bookmaker.markets) ? bookmaker.markets : [];
  const outcomes = key => {
    const market = markets.find(item => item.key === key);
    return market && Array.isArray(market.outcomes) ? market.outcomes : [];
  };

  return {
    event_id: game.id,
    sport_key: game.sport_key,
    sport_title: game.sport_title || game.sport_key,
    home_team: game.home_team,
    away_team: game.away_team,
    commence_time: game.commence_time,
    bookmaker: bookmaker ? bookmaker.title : "",
    last_update: bookmaker ? bookmaker.last_update : "",
    h2h: outcomes("h2h").map(item => ({ name: item.name, price: item.price })),
    spreads: outcomes("spreads").map(item => ({ name: item.name, price: item.price, point: item.point })),
    totals: outcomes("totals").map(item => ({ name: item.name, price: item.price, point: item.point }))
  };
}

function sortGames(games) {
  const now = Date.now();
  return games.sort((a, b) => {
    const depthA = a.h2h.length + a.spreads.length + a.totals.length;
    const depthB = b.h2h.length + b.spreads.length + b.totals.length;
    if (depthB !== depthA) return depthB - depthA;
    const timeA = a.commence_time ? new Date(a.commence_time).getTime() : 0;
    const timeB = b.commence_time ? new Date(b.commence_time).getTime() : 0;
    return Math.abs(timeA - now) - Math.abs(timeB - now);
  });
}

async function fetchSport(sport, apiKey) {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds`);
  url.searchParams.set("regions", REC_REGIONS);
  url.searchParams.set("markets", REC_MARKETS);
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("apiKey", apiKey);
  return fetchJson(url);
}

async function loadRecommendations(apiKey) {
  const settled = await Promise.allSettled(REC_SPORTS.map(sport => fetchSport(sport, apiKey)));
  const games = [];
  let remaining = null;
  let used = null;
  let successfulFeeds = 0;

  for (const result of settled) {
    if (result.status !== "fulfilled" || !result.value) continue;
    successfulFeeds += 1;
    const { data, headers } = result.value;
    if (remaining === null && headers["x-requests-remaining"] !== undefined) remaining = headers["x-requests-remaining"];
    if (used === null && headers["x-requests-used"] !== undefined) used = headers["x-requests-used"];
    if (Array.isArray(data)) games.push(...data.map(pickGame));
  }
  if (successfulFeeds === 0) throw new Error("all odds feeds failed");

  const unique = new Map();
  for (const game of games) unique.set(game.event_id, game);
  const sorted = sortGames([...unique.values()]).slice(0, 8);
  return {
    ok: true,
    games_count: sorted.length,
    games: sorted,
    requests_remaining: remaining,
    requests_used: used,
    cached: false,
    message: sorted.length === 0 ? "暂无可展示指数" : ""
  };
}

async function fetchOddsRecommendations() {
  const now = Date.now();
  if (recCache.data && now - recCache.ts < ODDS_CACHE_TTL_MS) {
    return { ...recCache.data, cached: true };
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return null;
  if (recCache.inFlight) return recCache.inFlight;

  recCache.inFlight = loadRecommendations(apiKey)
    .then(result => {
      recCache.data = result;
      recCache.ts = Date.now();
      return result;
    })
    .catch(error => {
      if (recCache.data) {
        console.warn("[odds] serving stale cache:", error.message);
        return { ...recCache.data, cached: true, stale: true };
      }
      throw error;
    })
    .finally(() => { recCache.inFlight = null; });
  return recCache.inFlight;
}

module.exports = {
  REC_SPORTS,
  REC_REGIONS,
  REC_MARKETS,
  recCache,
  pickGame,
  sortGames,
  fetchOddsRecommendations,
  fetchJson
};
