
const fs = require("fs");
let c = fs.readFileSync("server.js", "utf8");

const newEndpoint = `
// ==================== Odds API: Filtered sports ====================

app.get("/api/admin/odds/sports", authMiddleware, async (req, res) => {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: "ODDS_API_KEY not configured" });

    const url = "https://api.the-odds-api.com/v4/sports?apiKey=" + apiKey;
    https.get(url, (apiRes) => {
      let body = "";
      apiRes.on("data", c => body += c);
      apiRes.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (!Array.isArray(data)) return res.status(500).json({ ok: false, error: "Invalid response" });

          // Filter for soccer and basketball
          const soccer = data.filter(s => s.group === "Soccer");
          const basketball = data.filter(s => s.group === "Basketball");

          const pick = s => ({ key: s.key, group: s.group, title: s.title, description: s.description || "", active: s.active });

          res.json({
            ok: true,
            total_sports: data.length,
            soccer: { count: soccer.length, sports: soccer.map(pick) },
            basketball: { count: basketball.length, sports: basketball.map(pick) }
          });
        } catch (e) {
          res.status(500).json({ ok: false, error: "Failed to parse response" });
        }
      });
    }).on("error", (e) => {
      res.status(500).json({ ok: false, error: "Odds API request failed: " + e.message });
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

`;

// Insert after the odds/health endpoint closing clause: "});

app.listen"
// Find the closing of odds/health and insert before
const marker = "// ==================== Odds API Proxy ====================";
c = c.replace(marker, marker + newEndpoint);
fs.writeFileSync("server.js", c);
console.log("SPORTS_ENDPOINT_ADDED");

