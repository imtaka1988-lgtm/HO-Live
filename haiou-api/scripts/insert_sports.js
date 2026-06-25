
const fs = require("fs");
const path = "/var/www/haiou-api/server.js";
let c = fs.readFileSync(path, "utf8");

// The new endpoint code to insert
const newEndpoint = `app.get("/api/admin/odds/sports", authMiddleware, async (req, res) => {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: "ODDS_API_KEY not configured" });

    const url = "https://api.the-odds-api.com/v4/sports?apiKey=" + apiKey;
    https.get(url, (apiRes) => {
      let body = "";
      apiRes.on("data", ch => body += ch);
      apiRes.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (!Array.isArray(data)) return res.status(500).json({ ok: false, error: "Invalid response" });

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

// Find the line with "Odds API Proxy" and insert after the odds/health block closes
// The odds/health block ends with "});" then a blank line then app.listen
// Find: "  })
});

app.listen"
// Replace with: "  })
});

" + newEndpoint + "
app.listen"

const oldPattern = "  });

app.listen";
if (c.indexOf(oldPattern) !== -1) {
  c = c.replace(oldPattern, "  });

" + newEndpoint + "
app.listen");
  fs.writeFileSync(path, c);
  console.log("INSERTED");
} else {
  // Try alternate: the odds health block might end differently
  const altPattern = "    });
  })
});

app.listen";
  if (c.indexOf(altPattern) !== -1) {
    c = c.replace(altPattern, "    });
  })
});

" + newEndpoint + "
app.listen");
    fs.writeFileSync(path, c);
    console.log("INSERTED_ALT");
  } else {
    console.log("PATTERN_NOT_FOUND");
    // Show what's around app.listen
    const idx = c.indexOf("app.listen");
    if (idx > 0) {
      console.log("Around app.listen:");
      console.log(c.substring(Math.max(0, idx - 100), idx + 50));
    }
  }
}

