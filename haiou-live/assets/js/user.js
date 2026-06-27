/**
 * 海鸥直播 — 我的与关注模块
 */

import { state, href, asset, esc } from './config.js';
import { liveCard } from './ui.js';
import { getUserInfo, getUserFollows } from './api.js';

function ensureUserCenterStyles() {
  if (document.querySelector('link[data-user-center-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/css/user-center.css';
  link.dataset.userCenterStyle = '1';
  document.head.appendChild(link);
}

function getToken() {
  return localStorage.getItem('token') || '';
}

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem('user_profile') || '{}');
  } catch {
    return {};
  }
}

function maskPhone(phone) {
  const s = String(phone || '');
  if (s.length < 7) return s || '未绑定手机号';
  return s.slice(0, 3) + '****' + s.slice(-4);
}

function levelMeta(expValue) {
  const exp = Number(expValue || 0);
  const points = [0, 50, 150, 300, 600];
  let level = 1;
  for (let i = 0; i < points.length; i += 1) {
    if (exp >= points[i]) level = i + 1;
  }
  const current = points[level - 1] || 0;
  const next = points[level] || null;
  const percent = next ? Math.max(0, Math.min(100, Math.round(((exp - current) / (next - current)) * 100))) : 100;
  return { level, exp, current, next, percent };
}

function levelClass(levelValue) {
  const n = Math.max(1, Math.min(5, Number(levelValue || 1)));
  return 'level-color-lv' + n;
}

function levelPalette(levelValue) {
  const n = Math.max(1, Math.min(5, Number(levelValue || 1)));
  const map = {
    1: { bg: '#f1f5f9', text: '#334155', main: '#64748b', grad: 'linear-gradient(90deg,#94a3b8,#64748b)' },
    2: { bg: '#ecfdf5', text: '#047857', main: '#10b981', grad: 'linear-gradient(90deg,#34d399,#059669)' },
    3: { bg: '#eff6ff', text: '#1d4ed8', main: '#3b82f6', grad: 'linear-gradient(90deg,#60a5fa,#2563eb)' },
    4: { bg: '#f5f3ff', text: '#7c3aed', main: '#8b5cf6', grad: 'linear-gradient(90deg,#a78bfa,#7c3aed)' },
    5: { bg: '#fff7ed', text: '#c2410c', main: '#f97316', grad: 'linear-gradient(90deg,#facc15,#f97316,#ef4444)' }
  };
  return map[n];
}

function levelBadgeStyle(levelValue) {
  const p = levelPalette(levelValue);
  return `background:${p.bg};color:${p.text};box-shadow:inset 0 0 0 1px ${p.main}22;`;
}

function levelProgressHtml(meta) {
  const text = meta.next ? `${meta.exp}/${meta.next} 经验` : `${meta.exp} 经验`;
  const p = levelPalette(meta.level);
  return `<section class="user-level-card ${levelClass(meta.level)}" data-level-progress style="border:1px solid ${p.main}22;">
    <div><b>LV.${esc(meta.level)} 成长进度</b><span id="userExpText" style="color:${p.main};">${esc(text)}</span></div>
    <i><em id="userExpBar" style="width:${meta.percent}%;background:${p.grad};"></em></i>
    <p>关注直播间可获得经验，后续会逐步加入发言、观看回放等成长任务。</p>
  </section>`;
}

function formatMessageTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

function renderUserMessageList(messages) {
  if (!messages || !messages.length) {
    return `<div class="follow-empty-box">
      <b>暂无系统站内信</b>
      <span>后续系统通知、活动提醒会在这里显示。</span>
    </div>`;
  }

  return `<div style="display:grid;gap:10px;">
    ${messages.slice(0, 6).map(m => `<article style="padding:12px;border-radius:14px;background:#f8fafc;border:1px solid #eef2f7;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px;">
        <b style="color:#111827;font-size:14px;font-weight:900;">${esc(m.title || '系统通知')}</b>
        <span style="color:#f97316;font-size:11px;font-weight:900;white-space:nowrap;">${esc(formatMessageTime(m.createdAt))}</span>
      </div>
      <p style="margin:0;color:#4b5563;font-size:13px;line-height:1.65;">${esc(m.content || '')}</p>
    </article>`).join('')}
  </div>`;
}

function openLatestMessageModal(message) {
  if (!message || !message.id) return;
  const key = 'site_message_seen_' + message.id;
  if (localStorage.getItem(key) === '1') return;
  localStorage.setItem(key, '1');

  const existing = document.querySelector('#siteMessageModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'siteMessageModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:18px;';
  overlay.innerHTML = `<div style="width:min(420px,100%);border-radius:20px;background:#fff;box-shadow:0 22px 60px rgba(15,23,42,.28);overflow:hidden;">
    <div style="padding:16px 18px;background:linear-gradient(135deg,#111827,#1f2937);color:#fff;">
      <div style="font-size:12px;font-weight:900;opacity:.8;margin-bottom:5px;">系统站内信</div>
      <h2 style="margin:0;font-size:18px;font-weight:900;line-height:1.35;">${esc(message.title || '系统通知')}</h2>
    </div>
    <div style="padding:18px;color:#374151;font-size:14px;line-height:1.75;white-space:pre-wrap;">${esc(message.content || '')}</div>
    <div style="display:flex;gap:10px;padding:0 18px 18px;">
      <button id="siteMessageClose" type="button" style="flex:1;height:40px;border:0;border-radius:999px;background:#ff8a00;color:#fff;font-weight:900;">我知道了</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#siteMessageClose')?.addEventListener('click', close);
}

async function loadUserMessages(token) {
  const list = document.querySelector('#userMessageList');
  const count = document.querySelector('#userMessageCount');
  const hint = document.querySelector('#userMessageHint');
  if (!token) return;

  try {
    const res = await fetch('/api/user/messages', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!data || !data.ok) throw new Error('message load failed');
    const messages = data.messages || [];
    if (list) list.innerHTML = renderUserMessageList(messages);
    const text = messages.length ? `${messages.length} 条系统通知` : '暂无系统通知';
    if (count) count.textContent = messages.length ? `有 ${messages.length} 条` : '暂无';
    if (hint) hint.textContent = text;
    if (messages.length) openLatestMessageModal(messages[0]);
  } catch (e) {
    if (list) list.innerHTML = '<div class="follow-empty-box"><b>站内信加载失败</b><span>请稍后刷新重试。</span></div>';
    if (count) count.textContent = '加载失败';
    if (hint) hint.textContent = '站内信加载失败';
  }
}

function followRoomCard(room) {
  return `<a class="follow-room-card" href="${href('pages/room.html?id=' + room.id)}">
    <img src="${asset(room.cover || 'assets/img/thumb-1.svg')}" alt="${esc(room.title || '')}">
    <div><b>${esc(room.title || '直播间')}</b><span>${esc(room.anchorName || '主播')} · ${esc(room.status || 'offline')}</span></div>
    <em>进入</em>
  </a>`;
}

function renderFollowRooms(rooms) {
  if (!rooms || !rooms.length) {
    return `<div class="follow-empty-box">
      <b>暂未关注直播间</b>
      <span>进入直播间点击“关注”，这里会自动显示。</span>
      <a href="${href('pages/live.html')}">去看看直播</a>
    </div>`;
  }
  return `<div class="follow-room-list">${rooms.map(followRoomCard).join('')}</div>`;
}

function updateLevelDom(user) {
  if (!user) return;
  const meta = levelMeta(user.exp !== undefined ? user.exp : user.coins);
  const theme = levelClass(meta.level);
  const p = levelPalette(meta.level);
  document.querySelectorAll('#userLevel').forEach(el => { el.textContent = 'LV.' + meta.level; });
  document.querySelectorAll('#userCoins').forEach(el => { el.textContent = String(meta.exp); });
  document.querySelectorAll('[data-level-color]').forEach(el => {
    el.classList.remove('level-color-lv1', 'level-color-lv2', 'level-color-lv3', 'level-color-lv4', 'level-color-lv5');
    el.classList.add(theme);
    el.setAttribute('style', levelBadgeStyle(meta.level));
    if (el.classList.contains('user-level-badge')) el.textContent = 'LV.' + meta.level + ' 普通观众';
  });
  document.querySelectorAll('[data-level-progress]').forEach(el => {
    el.classList.remove('level-color-lv1', 'level-color-lv2', 'level-color-lv3', 'level-color-lv4', 'level-color-lv5');
    el.classList.add(theme);
    el.style.borderColor = p.main + '22';
  });
  document.querySelectorAll('#userExpText').forEach(el => { el.textContent = meta.next ? `${meta.exp}/${meta.next} 经验` : `${meta.exp} 经验`; el.style.color = p.main; });
  document.querySelectorAll('#userExpBar').forEach(el => { el.style.width = meta.percent + '%'; el.style.background = p.grad; });
}

export function renderFollow() {
  ensureUserCenterStyles();
  const token = getToken();

  if (!token) {
    return `<main class="mobile-page">
      <section class="m-follow-empty">
        <div class="m-empty-icon"></div>
        <div>登录账号关注喜欢的主播</div>
        <a class="m-login-btn" href="${href('pages/login.html')}">登录</a>
      </section>
      <div class="m-section-title">为你推荐</div>
      <div class="m-live-grid">${state.cfg.rooms.slice(0,6).map(r => liveCard(r)).join('')}</div>
    </main>
    <main class="page-shell pc-only">
      <div class="container">
        <div class="admin-card">
          <h2>关注</h2>
          <p>登录后可查看已关注的直播间。</p>
          <a class="user-main-btn" href="${href('pages/login.html')}">登录 / 注册</a>
        </div>
      </div>
    </main>`;
  }

  return `<main class="mobile-page user-center-page">
    <section class="user-center-hero">
      <div class="user-center-profile">
        <img src="${asset('assets/img/avatar-default.svg')}" alt="">
        <div><h2>我的关注</h2><p>你关注的直播间会显示在这里</p></div>
      </div>
    </section>
    <section class="user-center-section">
      <h3>已关注直播间</h3>
      <div id="followList"><div class="follow-loading">关注列表加载中...</div></div>
    </section>
  </main>
  <main class="page-shell pc-only">
    <div class="container">
      <div class="user-center-pc-panel">
        <h2 style="margin:0 0 14px;font-size:20px;font-weight:900;color:#111827;">我的关注</h2>
        <div id="pcFollowList"><div class="follow-loading">关注列表加载中...</div></div>
      </div>
    </div>
  </main>`;
}

export function renderUser() {
  ensureUserCenterStyles();
  const token = getToken();
  const user = getProfile();

  if (!token) {
    return `<main class="mobile-page user-page user-center-page">
      <section class="user-empty-card">
        <img src="${asset('assets/img/avatar-default.svg')}" alt="">
        <h2>登录后进入我的海鸥</h2>
        <p>登录后可参与聊天室发言，后续可使用关注、回放记录和交流群入口。</p>
        <a class="user-main-btn" href="${href('pages/login.html')}">立即登录</a>
      </section>
    </main>
    <main class="page-shell pc-only">
      <div class="container">
        <div class="user-pc-card">
          <h2>会员信息</h2>
          <p>登录后可查看账号身份、发言状态和常用入口。</p>
          <a class="user-main-btn" href="${href('pages/login.html')}">登录 / 注册</a>
        </div>
      </div>
    </main>`;
  }

  const exp = user.exp !== undefined ? user.exp : (user.coins || 0);
  const meta = levelMeta(exp);
  const nickname = user.nickname || '海鸥用户';
  const phone = maskPhone(user.phone);
  const level = user.level || meta.level;
  const theme = levelClass(level);
  const followCount = user.followCount || 0;
  const avatar = user.avatar || 'assets/img/avatar-default.svg';

  return `<main class="mobile-page user-page user-center-page">
    <section class="user-center-hero">
      <div class="user-center-profile">
        <img src="${asset(avatar)}" alt="">
        <div>
          <h2 id="userNickname">${esc(nickname)}</h2>
          <p id="userPhone">${esc(phone)}</p>
        </div>
      </div>
      <div class="user-center-badges">
        <span class="user-level-badge ${theme}" data-level-color style="${levelBadgeStyle(level)}">LV.${esc(level)} 普通观众</span>
        <span>已登录</span>
        <span>可参与聊天室发言</span>
      </div>
    </section>

    <section class="user-center-stats">
      <div><b id="userLevel">LV.${esc(level)}</b><span>等级</span></div>
      <div><b id="userFollowCount">${esc(followCount)}</b><span>关注</span></div>
      <div><b id="userCoins">${esc(exp)}</b><span>经验</span></div>
    </section>

    ${levelProgressHtml(meta)}

    <section class="user-center-section" id="userMessageSection">
      <h3 style="display:flex;align-items:center;justify-content:space-between;gap:10px;">系统站内信 <span id="userMessageCount" style="color:#f97316;font-size:12px;font-weight:900;">加载中</span></h3>
      <div id="userMessageList"><div class="follow-loading">站内信加载中...</div></div>
    </section>

    <section class="user-center-section">
      <h3>常用入口</h3>
      <div class="user-center-actions">
        <a class="user-center-action" href="#userMessageSection">我的消息<span id="userMessageHint">正在检查系统通知</span></a>
        <a class="user-center-action" href="${href('pages/follow.html')}">我的关注<span>关注直播间与主播</span></a>
        <a class="user-center-action" href="${href('pages/replays.html')}">懂球帝资讯<span>最新足球赛事报道</span></a>
        <a class="user-center-action" href="${href('pages/app.html')}">交流群<span>加入球迷交流入口</span></a>
        <a class="user-center-action" href="#" data-user-soon>修改资料<span>头像昵称后续开放</span></a>
      </div>
    </section>

    <section class="user-center-section">
      <h3>账号状态</h3>
      <div class="user-center-actions">
        <a class="user-center-action" href="#" data-user-soon>账号与绑定<span>${esc(phone)}</span></a>
        <a class="user-center-action" href="#" data-user-soon>观看记录<span>后续记录回放浏览</span></a>
      </div>
    </section>

    <section class="user-center-note">当前账号已开通聊天室发言身份。系统站内信会在进入“我的”时自动弹窗提醒。</section>

    <section style="margin:14px 12px 0;"><button id="btnUserLogoutMobile" class="user-center-logout" type="button">退出登录</button></section>
  </main>

  <main class="page-shell pc-only">
    <div class="container">
      <div class="user-center-pc">
        <div class="user-center-pc-card">
          <div class="user-center-pc-head">
            <img src="${asset(avatar)}" alt="">
            <div>
              <h2 id="pcUserNickname">${esc(nickname)}</h2>
              <p id="pcUserPhone">${esc(phone)}</p>
            </div>
          </div>
          <div class="user-center-pc-tags">
            <span class="user-level-badge ${theme}" data-level-color style="${levelBadgeStyle(level)}">LV.${esc(level)} 普通观众</span>
            <span>已登录</span>
            <span>聊天室可发言</span>
          </div>
          <div class="user-center-pc-grid">
            <div><b>LV.${esc(level)}</b><span>等级</span></div>
            <div><b id="pcUserFollowCount">${esc(followCount)}</b><span>关注</span></div>
            <div><b>${esc(exp)}</b><span>经验</span></div>
          </div>
          ${levelProgressHtml(meta)}
        </div>
        <div class="user-center-pc-panel">
          <h2 style="margin:0 0 14px;font-size:20px;font-weight:900;color:#111827;">会员快捷入口</h2>
          <div class="user-center-pc-links">
            <a href="#userMessageSection">我的消息</a>
            <a href="${href('pages/follow.html')}">我的关注</a>
            <a href="${href('pages/replays.html')}">懂球帝资讯</a>
            <a href="${href('pages/app.html')}">交流群</a>
            <button type="button" data-user-soon>修改资料</button>
            <button id="btnUserLogoutPc" class="user-center-logout" type="button">退出登录</button>
          </div>
        </div>
        <div class="user-center-pc-panel" id="pcUserMessageSection" style="grid-column:1 / -1;">
          <h2 style="margin:0 0 14px;font-size:20px;font-weight:900;color:#111827;">系统站内信 <span id="pcUserMessageCount" style="color:#f97316;font-size:12px;font-weight:900;">加载中</span></h2>
          <div id="pcUserMessageList"><div class="follow-loading">站内信加载中...</div></div>
        </div>
      </div>
    </div>
  </main>`;
}

export function bindUserEvents() {
  const token = getToken();

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user_profile');
    location.href = href('pages/login.html');
  }

  const mLogout = document.querySelector('#btnUserLogoutMobile');
  const pcLogout = document.querySelector('#btnUserLogoutPc');

  if (mLogout) mLogout.addEventListener('click', logout);
  if (pcLogout) pcLogout.addEventListener('click', logout);

  document.querySelectorAll('[data-user-soon]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      alert('这个功能后续开放，当前账号已可用于聊天室发言。');
    });
  });

  if (!token) return;

  getUserInfo(token).then(function (res) {
    if (!res || !res.ok || !res.user) return;
    localStorage.setItem('user_profile', JSON.stringify(res.user));
    updateLevelDom(res.user);
    if (res.user.followCount !== undefined) {
      document.querySelectorAll('#userFollowCount,#pcUserFollowCount').forEach(el => el.textContent = String(res.user.followCount || 0));
    }
  }).catch(function () {});

  loadUserMessages(token);

  const followBox = document.querySelector('#followList');
  const pcFollowBox = document.querySelector('#pcFollowList');
  if (followBox || pcFollowBox) {
    getUserFollows(token).then(function (res) {
      if (!res || !res.ok) throw new Error('failed');
      const html = renderFollowRooms(res.rooms || []);
      if (followBox) followBox.innerHTML = html;
      if (pcFollowBox) pcFollowBox.innerHTML = html;
    }).catch(function () {
      const html = '<div class="follow-empty-box"><b>关注列表加载失败</b><span>请稍后刷新重试。</span></div>';
      if (followBox) followBox.innerHTML = html;
      if (pcFollowBox) pcFollowBox.innerHTML = html;
    });
  }
}
