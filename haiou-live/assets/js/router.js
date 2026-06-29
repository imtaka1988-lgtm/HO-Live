
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
import { renderRoomReplaySection, renderReplaysPage, initRoomReplays } from './replays.js';
import { getRoomFollowStatus, followRoom, unfollowRoom } from './api.js';

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

function roomSeed(room) {
  const raw = Number(room && room.id ? room.id : 1);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function pickSpecialties(category, seed) {
  const football = [
    ['英超', '欧冠', '亚冠'],
    ['西甲', '意甲', '世界杯'],
    ['德甲', '法甲', '中超'],
    ['欧冠', '英超', '国家队赛事']
  ];
  const basketball = [
    ['NBA', 'CBA', '世界杯'],
    ['NBA', '欧洲杯', '亚洲杯'],
    ['CBA', 'NBA', '篮世预'],
    ['NBA', 'WNBA', 'NCAA']
  ];
  const mixed = [
    ['英超', 'NBA', '世界杯'],
    ['欧冠', 'CBA', '亚冠'],
    ['西甲', 'NBA', '中超'],
    ['意甲', '德甲', 'CBA']
  ];
  const list = category === 'football' ? football : (category === 'basketball' ? basketball : mixed);
  return list[seed % list.length];
}

function buildRoomAnchorProfile(room, host, anchorName) {
  const seed = roomSeed(room);
  const category = String(room && room.category ? room.category : '').toLowerCase();
  const isFootball = category === 'football';
  const isBasketball = category === 'basketball';
  const footballAccuracy = Math.min(88, (isFootball ? 72 : 63) + ((seed * 7) % 13));
  const basketballAccuracy = Math.min(86, (isBasketball ? 71 : 61) + ((seed * 11) % 14));
  const rank = ((seed * 13) % 96) + 1;
  const avatar = room.anchorAvatar || host.avatar || 'assets/img/avatar-default.svg';
  const name = anchorName || '主播';
  const intro = isFootball
    ? '专注足球临场节奏、阵容变化与指数走势解读。'
    : (isBasketball ? '专注篮球攻防节奏、伤停变化与大小分思路。' : '专注足球、篮球赛事分析与直播解读。');

  return {
    name,
    intro,
    avatar,
    wechatGroupQr: avatar,
    footballAccuracy: footballAccuracy + '%',
    basketballAccuracy: basketballAccuracy + '%',
    rank: '全站第' + rank + '位',
    specialties: pickSpecialties(category, seed),
    contact: '请联系主播助理'
  };
}

async function initRoomFollow(roomId) {
  const btn = document.querySelector('.follow-btn');
  if (!btn || !roomId) return;

  const token = localStorage.getItem('token') || '';
  let followed = false;

  function paint() {
    btn.textContent = followed ? '已关注' : '关注';
    btn.classList.toggle('is-followed', followed);
  }

  if (!token) {
    btn.addEventListener('click', function () {
      location.href = href('pages/login.html');
    });
    return;
  }

  btn.disabled = true;
  const status = await getRoomFollowStatus(roomId, token);
  followed = !!(status && status.ok && status.followed);
  paint();
  btn.disabled = false;

  btn.addEventListener('click', async function () {
    btn.disabled = true;
    const result = followed ? await unfollowRoom(roomId, token) : await followRoom(roomId, token);
    if (result && result.ok) {
      followed = !!result.followed;
      paint();
    } else {
      alert('关注操作失败，请稍后重试');
    }
    btn.disabled = false;
  });
}

export function renderRoom() {
  document.body.classList.add('mobile-room');
  const id = qs.get('id') || '1';
  const room = getRoom(id);
  const host = getHost(room.hostId);
  const anchorName = room.anchorName || host.name || '主播';
  const announcement = room.announcement || '欢迎进入直播间，请文明发言';
  const statusMeta = roomStatusMeta(room);
  state.cfg.anchorProfile = buildRoomAnchorProfile(room, host, anchorName);
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
  initRoomFollow(room.id);

  if (statusMeta.playable) {
    initPlayer(room);
  }
  initRoomReplays();
  updateRoomViewportHeight();
  window.addEventListener('resize', updateRoomViewportHeight);
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', updateRoomViewportHeight); window.visualViewport.addEventListener('scroll', updateRoomViewportHeight); }
}

function updateRoomViewportHeight() {
  if (document.body.dataset.page !== 'room') return;
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (h) document.documentElement.style.setProperty('--room-vh', Math.round(h) + 'px');
  if (document.body.classList.contains('mobile-chat-focus')) {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}
function initPlayer(room) { const video = document.querySelector('#liveVideo'); const videoBox = document.querySelector('#videoBox'); if (!video) return; if (LivePlayer) { LivePlayer.init({ videoEl: video, container: videoBox || video.parentNode, room: room }); return; } const ph = document.querySelector('#videoPlaceholder'); const streamUrl = room.streamUrl || (room.streams && room.streams[0] && room.streams[0].url); if (streamUrl) { video.src = streamUrl; video.addEventListener('loadedmetadata', () => ph?.classList.add('hide')); video.addEventListener('play', () => ph?.classList.add('hide')); } }


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
  if (['user', 'follow'].includes(page)) bindUserEvents();
}
