const express = require("express");
const authMiddleware = require("../middleware/auth");

function clean(value, maxLength, fallback = "") {
  const result = String(value == null ? "" : value).trim().slice(0, maxLength);
  return result || fallback;
}

async function getTemplate(pool) {
  const [rows] = await pool.query(
    "SELECT obs_server_template AS obsServerTemplate, obs_key_template AS obsKeyTemplate, hls_url_template AS hlsUrlTemplate, flv_url_template AS flvUrlTemplate FROM obs_template WHERE id = 1 LIMIT 1"
  );
  return rows[0] || { obsServerTemplate: "", obsKeyTemplate: "room{id}", hlsUrlTemplate: "", flvUrlTemplate: "" };
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/obs-template", authMiddleware, async (req, res) => {
    try {
      return res.json({ ok: true, template: await getTemplate(pool) });
    } catch (err) {
      console.error("[admin obs template get]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  router.put("/obs-template", authMiddleware, async (req, res) => {
    try {
      const body = req.body || {};
      const obsServerTemplate = clean(body.obsServerTemplate ?? body.obs_server_template, 255);
      const obsKeyTemplate = clean(body.obsKeyTemplate ?? body.obs_key_template, 255, "room{id}");
      const hlsUrlTemplate = clean(body.hlsUrlTemplate ?? body.hls_url_template, 500);
      const flvUrlTemplate = clean(body.flvUrlTemplate ?? body.flv_url_template, 500);

      await pool.query(
        "INSERT INTO obs_template (id, obs_server_template, obs_key_template, hls_url_template, flv_url_template) VALUES (1, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE obs_server_template = VALUES(obs_server_template), obs_key_template = VALUES(obs_key_template), hls_url_template = VALUES(hls_url_template), flv_url_template = VALUES(flv_url_template)",
        [obsServerTemplate, obsKeyTemplate, hlsUrlTemplate, flvUrlTemplate]
      );
      return res.json({ ok: true, template: await getTemplate(pool) });
    } catch (err) {
      console.error("[admin obs template update]", err);
      return res.status(500).json({ ok: false, error: "服务器错误" });
    }
  });

  return router;
};
