/**
 * 海鸥直播 V4.2 — 路由分发
 */

import { page, qs } from './config.js';
import { renderHome, renderLive, bindHeroEvents } from './rooms.js';
import { renderSchedule } from './schedule.js';
import { renderLogin, bindLoginEvents } from './auth.js';
import { renderFollow, renderUser, bindUserEvents } from './user.js';
import { renderAdmin, bindAdminEvents } from './app-page.js';
import { renderCommunityPage } from './community-page.js';
import { state, href, asset, esc, getHost, getRoom } from './config.js';
import { renderChatList, renderAnchorProfile, initChatSocket } from './chat.js';
import { startRoomInfoPolling, stopRoomInfoPolling } from './room-refresh.js';
import { horizontalMatchCard } from './ui.js';
import { LivePlayer } from './player.js';
import { leagueName, matchName } from './odds-i18n.js';
import { renderRoomReplaySection, renderReplaysPage, initRoomReplays } from './replays.js';

function roomStatusMeta(room) {
  const status = String(room && room.status ? room.status : 'live').toLowerCase();

  if (status === 'pending') {
    return {
      playable: false,
      className: 'is-pending',
      title: '直播未开始',
      desc: '主播正在准备中，请稍后刷新。'
    };
  }

  if (status === 'offline' || status === 'maintenance') {
    return {
      playable: false,
      className: 'is-offline',
      title: '房间维护中',
      desc: '当前房间暂未开放，请稍后再进入。'
    };
  }

  return {
    playable: true,
    className: 'is-live',
    title: (room && room.quality ? room.quality : '高清') + '直播',
    desc: '正在连接直播源，请稍候。'
  };
}

export function renderRoom() {
  document.body.classList.add('mobile-room');
  const id = qs.get('id') || '1';
  const room = getRoom(id);
  const host = getHost(room.hostId);
  const anchorName = room.anchorName || host.name || '主播';
  const announcement = room.announcement || '欢迎进入直播间，请文明发言';
  const statusMeta = roomStatusMeta(room);
  if (room.anchorName && state.cfg.anchorProfile) {
    state.cfg.anchorProfile.name = room.anchorName;
  }
  const app = document.querySelector('#app');
  if (!app) return;
 const ad = state.cfg.ads && state.cfg.ads.roomPlayerAd;
 const adHtml = (ad && ad.enabled) ? `<a class="player-ad-bar" href="${href(ad.link || '#')}" target="_blank"><img src="${asset(ad.image)}" alt=""><div class="ad-body"><div class="ad-title">${esc(ad.title || '')}</div><div class="ad-desc">${esc(ad.desc || '')}</div></div><span class="ad-btn">${esc(ad.buttonText || '查看')}</span></a>` : '<div class="player-ad-bar player-ad-placeholder">广告位</div>';
 app.innerHTML = `<section class="room-stage"><div class="container room-grid"><div class="player-panel"><div class="player-head"><div class="player-host"><img src="${asset(host.avatar)}"><div><h1>${esc(room.title || '直播间')}</h1></div></div><button class="follow-btn">关注</button></div><div class="video-box" id="videoBox" data-room-status="${esc(room.status || 'live')}"><video id="liveVideo" controls playsinline poster="${asset(room.cover || '')}"></video><div class="video-placeholder room-status-placeholder ${esc(statusMeta.className)}" id="videoPlaceholder"><b>${esc(statusMeta.title)}</b><span>${esc(statusMeta.desc)}</span></div></div><div class="player-bottom">${adHtml}</div><div class="mobile-chat-section mobile-only"><div class="mobile-chat-notice">📢 公告：${esc(announcement)}</div><div class="mobile-chat-tabs"><span data-tab="chat" class="is-active">聊天</span><span data-tab="profile">主播资料</span></div><div class="mobile-chat-body" id="mobileChatBody">${renderChatList()}</div><div class="mobile-chat-body hide" id="mobileProfileBody">${renderAnchorProfile()}</div><div class="mobile-chat-input"><input placeholder="聊天室连接中..." readonly><button disabled>连接中</button></div></div></div><aside class="chat-panel"><div class="chat-notice">📢 公告：${esc(announcement)}</div><div class="chat-tabs"><span data-tab="chat" class="is-active">聊天室</span><span data-tab="profile">主播资料</span></div><div class="chat-body" id="chatBody">${renderChatList()}</div><div class="chat-body hide" id="profileBody">${renderAnchorProfile()}</div><div class="chat-input"><input placeholder="聊天室连接中..." readonly><button disabled>连接中</button></div></aside></div></section>${renderRoomReplaySection()}`;

  const pcTabs = document.querySelectorAll('.chat-tabs span');
  const chatBody = document.querySelector('#chatBody');
  const profileBody = document.querySelector('#profileBody');
  if (pcTabs.length && chatBody && profileBody) { pcTabs.forEach(t => { t.addEventListener('click', function () { pcTabs.forEach(x => x.classList.remove('is-active')); this.classList.add('is-active'); if (this.dataset.tab === 'chat') { chatBody.classList.remove('hide'); profileBody.classList.add('hide'); } else { profileBody.classList.remove('hide'); chatBody.classList.add('hide'); } }); }); }
  const mobileTabs = document.querySelectorAll('.mobile-chat-tabs span');
  const mobileChatBody = document.querySelector('#mobileChatBody');
  const mobileProfileBody = document.querySelector('#mobileProfileBody');
  if (mobileTabs.length && mobileChatBody && mobileProfileBody) { mobileTabs.forEach(t => { t.addEventListener('click', function () { mobileTabs.forEach(x => x.classList.remove('is-active')); this.classList.add('is-active'); if (this.dataset.tab === 'chat') { mobileChatBody.classList.remove('hide'); mobileProfileBody.classList.add('hide'); } else { mobileProfileBody.classList.remove('hide'); mobileChatBody.classList.add('hide'); } }); }); }
  setTimeout(() => initChatSocket(room.id), 120);
  startRoomInfoPolling(room.id);

  const mobileInput = document.querySelector('.mobile-chat-input input');
  if (mobileInput) { mobileInput.addEventListener('focus', () => document.body.classList.add('mobile-chat-focus')); mobileInput.addEventListener('blur', () => document.body.classList.remove('mobile-chat-focus')); }

  if (statusMeta.playable) {
    initPlayer(room);
  }
  initRoomReplays();
  updateRoomViewportHeight();
  window.addEventListener('resize', updateRoomViewportHeight);
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', updateRoomViewportHeight); window.visualViewport.addEventListener('scroll', updateRoomViewportHeight); }
}

function updateRoomViewportHeight() { if (document.body.dataset.page !== 'room') return; const h = window.visualViewport ? window.visualViewport.height : window.innerHeight; document.documentElement.style.setProperty('--room-vh', h + 'px'); }
function initPlayer(room) { const video = document.querySelector('#liveVideo'); const videoBox = document.querySelector('#videoBox'); if (!video) return; if (LivePlayer) { LivePlayer.init({ videoEl: video, container: videoBox || video.parentNode, room: room }); return; } const ph = document.querySelector('#videoPlaceholder'); const streamUrl = room.streamUrl || (room.streams && room.streams[0] && room.streams[0].url); if (streamUrl) { video.src = streamUrl; video.addEventListener('loadedmetadata', () => ph?.classList.add('hide')); video.addEventListener('play', () => ph?.classList.add('hide')); } }

// ===================== 实时指数（保留旧函数，当前直播页已改为经典回顾） =====================

async function loadOddsForRoom(roomId) { var area = document.querySelector('#roomOddsArea'); var scroll = document.querySelector('#oddsScroll'); if (!area || !scroll) return; try { var res = await fetch('/api/public/rooms/' + roomId + '/odds'); if (!res.ok) { area.style.display = 'none'; return; } var data = await res.json(); } catch (e) { area.style.display = 'none'; return; } if (!data.ok || !data.display || !data.games || data.games.length === 0) { area.style.display = 'none'; return; } var titleEl = area.querySelector('h2'); if (titleEl) titleEl.textContent = data.title || '实时指数'; if (data.message) { var msgEl = area.querySelector('.odds-disclaimer'); if (msgEl) msgEl.textContent = data.message; } renderOddsCards(data.games, scroll); resizeOddsCards(); }
function formatTime(iso) { if (!iso) return ''; var m = iso.match(/T(\d{2}:\d{2})/); return m ? m[1] : ''; }
function renderOddsCards(games, container) { var html = ''; for (var i = 0; i < games.length; i++) { var g = games[i]; html += '<div class="odds-card">'; html += '<div class="odds-card-header"><span class="odds-sport">' + esc(leagueName(g.sport_title, g.sport_key)) + '</span><span class="odds-time">' + formatTime(g.commence_time) + '</span></div>'; html += '<div class="odds-teams">' + esc(matchName(g.home_team, g.away_team)) + '</div>'; if (g.h2h && g.h2h.length === 2) { html += '<div class="odds-row"><span class="odds-label">胜负</span><span class="odds-item">主 <b>' + g.h2h[0].price + '</b></span><span class="odds-item">客 <b>' + g.h2h[1].price + '</b></span></div>'; } if (g.spreads && g.spreads.length === 2) { html += '<div class="odds-row"><span class="odds-label">让分</span><span class="odds-item">主' + (g.spreads[0].point > 0 ? '+' : '') + g.spreads[0].point + '&nbsp;<b>' + g.spreads[0].price + '</b></span><span class="odds-item">客' + (g.spreads[1].point > 0 ? '+' : '') + g.spreads[1].point + '&nbsp;<b>' + g.spreads[1].price + '</b></span></div>'; } if (g.totals && g.totals.length === 2) { html += '<div class="odds-row"><span class="odds-label">大小</span><span class="odds-item">大 ' + g.totals[0].point + '&nbsp;<b>' + g.totals[0].price + '</b></span><span class="odds-item">小 ' + g.totals[1].point + '&nbsp;<b>' + g.totals[1].price + '</b></span></div>'; } html += '<div class="odds-footer">数据来源：' + esc(g.bookmaker || '') + '</div>'; html += '</div>'; } container.innerHTML = html; }

// ===================== 自适应卡片宽度（全局共用的 resize） ———

function resizeOddsCards() {
  if (window.innerWidth <= 768) return;
  document.querySelectorAll('[data-odds-scroll]').forEach(function (container) {
    var gap = 16, minCardWidth = 300, cw = container.clientWidth;
    if (!cw || cw < minCardWidth) return;
    var cols = 4;
    if ((cw - gap * 3) / 4 < minCardWidth) cols = 3;
    var cardWidth = Math.floor((cw - gap * (cols - 1)) / cols);
    container.style.setProperty('--odds-card-width', cardWidth + 'px');
    container.style.setProperty('--odds-gap', gap + 'px');
    container.dataset.visibleCards = String(cols);
  });
}

if (!window._oddsResizeBound) { window._oddsResizeBound = true; window.addEventListener('resize', resizeOddsCards); }

const ROUTE_MAP = { home: renderHome, live: renderLive, schedule: renderSchedule, replays: renderReplaysPage, room: renderRoom, follow: renderFollow, user: renderUser, login: renderLogin, app: renderCommunityPage, admin: renderAdmin };
export function bootPage() {
  const app = document.querySelector('#app');
  if (!app) return;

  if (page !== 'room') stopRoomInfoPolling();

  const fn = ROUTE_MAP[page] || renderHome;
  const html = fn();
  if (html) app.innerHTML = html;

  if (page === 'home') bindHeroEvents();
  if (page === 'replays') initRoomReplays();
  if (page === 'admin') bindAdminEvents();
  if (page === 'login') bindLoginEvents();
  if (page === 'user') bindUserEvents();
}
