/**
 * 主播后台页面
 */

import { esc } from './config.js';

function token() {
  return localStorage.getItem('anchor_token') || '';
}

async function apiJson(path, options) {
  const res = await fetch(path, {
    ...(options || {}),
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { 'Authorization': 'Bearer ' + token() } : {}),
      ...((options && options.headers) || {})
    }
  });
  return res.json();
}

function injectStyle() {
  if (document.querySelector('#anchorPageStyle')) return;
  const style = document.createElement('style');
  style.id = 'anchorPageStyle';
  style.textContent = `
    .anchor-page { max-width: 980px; margin: 0 auto; padding: 24px 14px 40px; }
    .anchor-card { background: #fff; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 10px 26px rgba(15,23,42,.06); padding: 18px; margin-bottom: 14px; }
    .anchor-card h1, .anchor-card h2 { margin: 0 0 8px; color: #111827; }
    .anchor-card p { margin: 0 0 14px; color: #6b7280; font-size: 13px; line-height: 1.6; }
    .anchor-login-box { max-width: 420px; margin: 50px auto; }
    .anchor-field { margin-bottom: 12px; }
    .anchor-field label { display: block; color: #374151; font-weight: 800; font-size: 13px; margin-bottom: 6px; }
    .anchor-field input, .anchor-field textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 10px; min-height: 38px; padding: 9px 10px; font-size: 14px; outline: none; }
    .anchor-field textarea { min-height: 80px; resize: vertical; }
    .anchor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .anchor-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .anchor-btn { height: 38px; padding: 0 16px; border-radius: 999px; border: 0; background: #111827; color: #fff; font-weight: 900; cursor: pointer; }
    .anchor-btn.primary { background: linear-gradient(135deg, #facc15, #f97316); color: #111827; }
    .anchor-btn.gray { background: #e5e7eb; color: #111827; }
    .anchor-code { display: flex; align-items: center; gap: 8px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; }
    .anchor-code code { flex: 1; min-width: 0; background: #111827; color: #fde68a; padding: 8px 10px; border-radius: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
    .anchor-copy { height: 32px; padding: 0 10px; border-radius: 8px; background: #f97316; color: #fff; border: 0; font-weight: 800; cursor: pointer; }
    .anchor-msg { min-height: 20px; margin-top: 10px; color: #16a34a; font-size: 13px; }
    .anchor-warn { padding: 10px 12px; background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; border-radius: 12px; font-size: 13px; line-height: 1.5; }
    @media (max-width: 767px) { .anchor-grid { grid-template-columns: 1fr; } .anchor-page { padding-bottom: 80px; } }
  `;
  document.head.appendChild(style);
}

export function renderAnchorPage() {
  injectStyle();
  if (!token()) {
    return `<main class="anchor-page"><section class="anchor-card anchor-login-box">
      <h1>主播后台登录</h1>
      <p>请使用管理员分配给你的主播账号登录。登录后只能管理绑定的直播间。</p>
      <div class="anchor-field"><label>主播账号</label><input id="anchorUser" placeholder="例如 anchor_room_1"></div>
      <div class="anchor-field"><label>主播密码</label><input id="anchorPass" type="password" placeholder="请输入密码"></div>
      <div class="anchor-actions"><button class="anchor-btn primary" id="btnAnchorLogin">登录主播后台</button></div>
      <div class="anchor-msg" id="anchorLoginMsg"></div>
    </section></main>`;
  }

  return `<main class="anchor-page">
    <section class="anchor-card">
      <h1>主播后台</h1>
      <p id="anchorWelcome">正在加载你的直播间...</p>
      <div class="anchor-actions"><button class="anchor-btn gray" id="btnAnchorLogout">退出登录</button></div>
    </section>
    <section class="anchor-card" id="anchorRoomCard"><p>加载中...</p></section>
    <section class="anchor-card" id="anchorStreamCard"><p>加载 OBS 推流信息...</p></section>
  </main>`;
}

function roomFormHtml(room) {
  return `<h2>我的直播间 #${esc(room.id)}</h2>
    <p>这里修改后会同步到前台直播间和管理员后台。</p>
    <div class="anchor-grid">
      <div class="anchor-field"><label>房间标题</label><input class="anchor-room-title" value="${esc(room.title || '')}"></div>
      <div class="anchor-field"><label>主播名称</label><input class="anchor-room-name" value="${esc(room.anchorName || '')}"></div>
    </div>
    <div class="anchor-field"><label>封面图片地址</label><input class="anchor-room-cover" value="${esc(room.cover || '')}" placeholder="填写图片 URL 或站内图片路径"></div>
    <div class="anchor-field"><label>直播间公告</label><textarea class="anchor-room-announcement">${esc(room.announcement || '')}</textarea></div>
    <div class="anchor-actions"><button class="anchor-btn primary" id="btnAnchorSaveRoom">保存房间资料</button></div>
    <div class="anchor-msg" id="anchorSaveMsg"></div>`;
}

function streamHtml(info) {
  const s = info.streamInfo || {};
  const server = s.obsServer || '';
  const key = s.obsStreamKey || '';
  return `<h2>OBS 推流信息</h2>
    <p>请在 OBS 里填写下面两项。不要把推流码发给无关人员。</p>
    <div class="anchor-field"><label>OBS 服务器</label><div class="anchor-code"><code title="${esc(server || '未配置')}">${esc(server || '未配置')}</code><button class="anchor-copy" data-copy="${esc(server)}" ${server ? '' : 'disabled'}>复制</button></div></div>
    <div class="anchor-field"><label>OBS 推流码</label><div class="anchor-code"><code title="${esc(key || '未配置')}">${esc(key || '未配置')}</code><button class="anchor-copy" data-copy="${esc(key)}" ${key ? '' : 'disabled'}>复制</button></div></div>
    <div class="anchor-warn">这里只展示管理员分配给你的 OBS 推流信息。播放地址由系统处理，你不需要填写。</div>`;
}

async function loadDashboard() {
  const me = await apiJson('/api/anchor/me');
  if (!me || !me.ok) {
    localStorage.removeItem('anchor_token');
    location.reload();
    return;
  }

  const welcome = document.querySelector('#anchorWelcome');
  if (welcome) welcome.textContent = '主播账号：' + me.anchor.username + '，绑定房间 #' + me.anchor.roomId;

  const roomCard = document.querySelector('#anchorRoomCard');
  if (roomCard) roomCard.innerHTML = roomFormHtml(me.room || {});

  const stream = await apiJson('/api/anchor/stream-info');
  const streamCard = document.querySelector('#anchorStreamCard');
  if (streamCard) streamCard.innerHTML = stream && stream.ok ? streamHtml(stream) : '<p>OBS 信息加载失败，请联系管理员。</p>';
}

async function login() {
  const username = (document.querySelector('#anchorUser') || {}).value || '';
  const password = (document.querySelector('#anchorPass') || {}).value || '';
  const msg = document.querySelector('#anchorLoginMsg');
  if (msg) msg.textContent = '登录中...';
  const data = await apiJson('/api/anchor/login', { method: 'POST', body: JSON.stringify({ username: username.trim(), password }) });
  if (!data || !data.ok) {
    if (msg) { msg.textContent = '登录失败：' + ((data && data.error) || '账号或密码错误'); msg.style.color = '#dc2626'; }
    return;
  }
  localStorage.setItem('anchor_token', data.token);
  location.reload();
}

async function saveRoom() {
  const msg = document.querySelector('#anchorSaveMsg');
  if (msg) { msg.textContent = '保存中...'; msg.style.color = '#16a34a'; }
  const body = {
    title: (document.querySelector('.anchor-room-title') || {}).value || '',
    anchor_name: (document.querySelector('.anchor-room-name') || {}).value || '',
    cover: (document.querySelector('.anchor-room-cover') || {}).value || '',
    announcement: (document.querySelector('.anchor-room-announcement') || {}).value || ''
  };
  const data = await apiJson('/api/anchor/room', { method: 'PUT', body: JSON.stringify(body) });
  if (data && data.ok) {
    if (msg) msg.textContent = '已保存，前台直播间会同步更新。';
  } else if (msg) {
    msg.textContent = '保存失败：' + ((data && data.error) || '未知错误');
    msg.style.color = '#dc2626';
  }
}

function copyText(value, btn) {
  const text = String(value || '');
  if (!text) return;
  navigator.clipboard.writeText(text).then(function () {
    const old = btn.textContent;
    btn.textContent = '已复制';
    setTimeout(function () { btn.textContent = old; }, 1200);
  }).catch(function () {
    window.prompt('复制下面内容：', text);
  });
}

export function bindAnchorEvents() {
  injectStyle();
  const loginBtn = document.querySelector('#btnAnchorLogin');
  if (loginBtn) loginBtn.addEventListener('click', login);

  const logoutBtn = document.querySelector('#btnAnchorLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', function () {
    localStorage.removeItem('anchor_token');
    location.reload();
  });

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnAnchorSaveRoom') saveRoom();
    if (e.target && e.target.classList && e.target.classList.contains('anchor-copy')) copyText(e.target.dataset.copy, e.target);
  });

  if (token()) loadDashboard();
}
