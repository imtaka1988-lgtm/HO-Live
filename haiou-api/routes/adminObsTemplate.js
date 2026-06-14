const express = require("express");
const authMiddleware = require("../middleware/auth");

let obsTemplateReady = false;

async function ensureObsTemplateTable(pool) {
  if (obsTemplateReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS obs_template (id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1, obs_server_template VARCHAR(255) NOT NULL DEFAULT '', obs_key_template VARCHAR(255) NOT NULL DEFAULT 'room{id}', hls_url_template VARCHAR(500) NOT NULL DEFAULT '', flv_url_template VARCHAR(500) NOT NULL DEFAULT '', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  await pool.query("INSERT IGNORE INTO obs_template (id, obs_server_template, obs_key_template, hls_url_template, flv_url_template) VALUES (1, '', 'room{id}', '', '')");
  obsTemplateReady = true;
}

async function getTemplate(pool) {
  await ensureObsTemplateTable(pool);
  const [rows] = await pool.query("SELECT obs_server_template AS obsServerTemplate, obs_key_template AS obsKeyTemplate, hls_url_template AS hlsUrlTemplate, flv_url_template AS flvUrlTemplate FROM obs_template WHERE id = 1");
  return rows[0] || { obsServerTemplate: '', obsKeyTemplate: 'room{id}', hlsUrlTemplate: '', flvUrlTemplate: '' };
}

module.exports = function (pool) {
  const router = express.Router();

  router.get("/obs-template", authMiddleware, async (req, res) => {
    try {
      const template = await getTemplate(pool);
      res.json({ ok: true, template });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.put("/obs-template", authMiddleware, async (req, res) => {
    try {
      await ensureObsTemplateTable(pool);
      const body = req.body || {};
      const obsServerTemplate = String(body.obsServerTemplate || body.obs_server_template || '').trim();
      const obsKeyTemplate = String(body.obsKeyTemplate || body.obs_key_template || 'room{id}').trim() || 'room{id}';
      const hlsUrlTemplate = String(body.hlsUrlTemplate || body.hls_url_template || '').trim();
      const flvUrlTemplate = String(body.flvUrlTemplate || body.flv_url_template || '').trim();
      await pool.query(
        "UPDATE obs_template SET obs_server_template = ?, obs_key_template = ?, hls_url_template = ?, flv_url_template = ? WHERE id = 1",
        [obsServerTemplate, obsKeyTemplate, hlsUrlTemplate, flvUrlTemplate]
      );
      const template = await getTemplate(pool);
      res.json({ ok: true, template });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
