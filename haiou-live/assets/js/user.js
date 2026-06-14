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

  const nickname = user.nickname || '海鸥用户';
  const phone = maskPhone(user.phone);
  const level = user.level || 1;
  const coins = user.coins || 0;
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
        <span>LV.${esc(level)} 普通观众</span>
        <span>已登录</span>
        <span>可参与聊天室发言</span>
      </div>
    </section>

    <section class="user-center-stats">
      <div><b id="userLevel">LV.${esc(level)}</b><span>等级</span></div>
      <div><b id="userFollowCount">${esc(followCount)}</b><span>关注</span></div>
      <div><b id="userCoins">${esc(coins)}</b><span>金币</span></div>
    </section>

    <section class="user-center-section">
      <h3>常用入口</h3>
      <div class="user-center-actions">
        <a class="user-center-action" href="${href('pages/follow.html')}">我的关注<span>关注直播间与主播</span></a>
        <a class="user-center-action" href="${href('pages/replays.html')}">赛事回放<span>查看经典比赛集锦</span></a>
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

    <section class="user-center-note">当前账号已开通聊天室发言身份。关注直播间后，会在“我的关注”中显示。</section>

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
            <span>LV.${esc(level)} 普通观众</span>
            <span>已登录</span>
            <span>聊天室可发言</span>
          </div>
          <div class="user-center-pc-grid">
            <div><b>LV.${esc(level)}</b><span>等级</span></div>
            <div><b id="pcUserFollowCount">${esc(followCount)}</b><span>关注</span></div>
            <div><b>${esc(coins)}</b><span>金币</span></div>
          </div>
        </div>
        <div class="user-center-pc-panel">
          <h2 style="margin:0 0 14px;font-size:20px;font-weight:900;color:#111827;">会员快捷入口</h2>
          <div class="user-center-pc-links">
            <a href="${href('pages/follow.html')}">我的关注</a>
            <a href="${href('pages/replays.html')}">赛事回放</a>
            <a href="${href('pages/app.html')}">交流群</a>
            <button type="button" data-user-soon>修改资料</button>
            <button id="btnUserLogoutPc" class="user-center-logout" type="button">退出登录</button>
          </div>
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
    if (res.user.followCount !== undefined) {
      document.querySelectorAll('#userFollowCount,#pcUserFollowCount').forEach(el => el.textContent = String(res.user.followCount || 0));
    }
  }).catch(function () {});

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
