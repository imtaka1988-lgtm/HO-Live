/**
 * 管理后台：全局 OBS 模板设置。
 */

let bound = false;

function token() { return localStorage.getItem('admin_token') || ''; }

async function apiJson(path, options) {
  const res = await fetch(path, {
    ...(options || {}),
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token(), ...((options && options.headers) || {}) }
  });
  return res.json();
}

function styleOnce() {
  if (document.querySelector('#adminObsTemplateStyle')) return;
  const style = document.createElement('style');
  style.id = 'adminObsTemplateStyle';
  style.textContent = `
    .admin-obs-template-card input { width:100%;height:34px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:0 9px;font-size:13px; }
    .admin-obs-template-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px; }
    .admin-obs-template-card label { display:block;font-size:12px;font-weight:800;color:#374151;margin-bottom:5px; }
    .admin-obs-template-card small { display:block;color:#999;font-size:11px;margin-top:4px;line-height:1.4; }
    .admin-obs-template-card button { margin-top:12px;padding:7px 16px;border-radius:999px;background:#111827;color:#fff;font-weight:800; }
    @media(max-width:768px){.admin-obs-template-grid{grid-template-columns:1fr;}}
  `;
  document.head.appendChild(style);
}

function cardHtml(t) {
  return `<div class="admin-card admin-obs-template-card" id="adminObsTemplateCard">
    <h2>全局 OBS 模板</h2>
    <p style="color:#999;margin-bottom:12px;">新建房间时会按这里的模板自动生成 OBS 信息。可用变量：{id}、{roomId}、{streamName}</p>
    <div class="admin-obs-template-grid">
      <div><label>OBS 服务器模板</label><input id="obsTplServer" value="${(t.obsServerTemplate || '').replace(/"/g, '&quot;')}" placeholder="例如 rtmp://push.s6.lol/live"><small>给主播填 OBS 的服务器地址。</small></div>
      <div><label>OBS 推流码模板</label><input id="obsTplKey" value="${(t.obsKeyTemplate || 'room{id}').replace(/"/g, '&quot;')}" placeholder="例如 room{id}"><small>默认 room{id}，房间 1 会生成 room1。</small></div>
      <div><label>HLS 播放地址模板（可选）</label><input id="obsTplHls" value="${(t.hlsUrlTemplate || '').replace(/"/g, '&quot;')}" placeholder="例如 https://live.s6.lol/live/room{id}.m3u8"><small>填写后，新房间会自动生成 HLS 播放源。</small></div>
      <div><label>FLV 播放地址模板（可选）</label><input id="obsTplFlv" value="${(t.flvUrlTemplate || '').replace(/"/g, '&quot;')}" placeholder="例如 https://live.s6.lol/live/room{id}.flv"><small>填写后，新房间会自动生成 FLV 播放源。</small></div>
    </div>
    <button type="button" id="btnSaveObsTemplate">保存 OBS 模板</button>
    <span id="obsTemplateMsg" style="margin-left:10px;font-size:12px;color:#16a34a;"></span>
  </div>`;
}

async function loadTemplate() {
  const data = await apiJson('/api/admin/obs-template');
  const t = (data && data.ok && data.template) ? data.template : {};
  const roomCard = document.querySelector('#roomTableContainer')?.closest('.admin-card');
  if (!roomCard || document.querySelector('#adminObsTemplateCard')) return;
  roomCard.insertAdjacentHTML('afterend', cardHtml(t));
}

async function saveTemplate() {
  const msg = document.querySelector('#obsTemplateMsg');
  if (msg) msg.textContent = '保存中...';
  const body = {
    obsServerTemplate: document.querySelector('#obsTplServer')?.value || '',
    obsKeyTemplate: document.querySelector('#obsTplKey')?.value || 'room{id}',
    hlsUrlTemplate: document.querySelector('#obsTplHls')?.value || '',
    flvUrlTemplate: document.querySelector('#obsTplFlv')?.value || ''
  };
  const data = await apiJson('/api/admin/obs-template', { method: 'PUT', body: JSON.stringify(body) });
  if (msg) msg.textContent = data && data.ok ? '已保存，新建房间会套用此模板' : '保存失败';
}

export function initAdminObsTemplatePanel() {
  if (bound || document.body.dataset.page !== 'admin') return;
  bound = true;
  styleOnce();
  setTimeout(loadTemplate, 600);
  setTimeout(loadTemplate, 1400);
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnSaveObsTemplate') saveTemplate();
  });
}
