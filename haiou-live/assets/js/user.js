/**
 * 海鸥直播 — 我的与关注模块
 */

import { state, href, asset, esc } from './config.js';
import { liveCard } from './ui.js';
import { getUserInfo } from './api.js';

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

export function renderFollow() {
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
        <p>PC 端关注页可后续扩展为主播列表、预约提醒和站内信。</p>
      </div>
    </div>
  </main>`;
}

export function renderUser() {
  const token = getToken();
  const user = getProfile();

  if (!token) {
    return `<main class="mobile-page user-page">
      <section class="user-empty-card">
        <img src="${asset('assets/img/avatar-default.svg')}" alt="">
        <h2>登录后查看我的资料</h2>
        <p>登录后可使用关注、聊天、个人资料等功能</p>
        <a class="user-main-btn" href="${href('pages/login.html')}">立即登录</a>
      </section>
    </main>
    <main class="page-shell pc-only">
      <div class="container">
        <div class="user-pc-card">
          <h2>我的</h2>
          <p>登录后可查看账号资料、等级、金币和消息。</p>
          <a class="user-main-btn" href="${href('pages/login.html')}">登录 / 注册</a>
        </div>
      </div>
    </main>`;
  }

  const nickname = user.nickname || '海鸥用户';
  const phone = maskPhone(user.phone);
  const level = user.level || 0;
  const coins = user.coins || 0;
  const avatar = user.avatar || 'assets/img/avatar-default.svg';

  return `<main class="mobile-page user-page">
    <section class="user-head user-head-v2">
      <div class="user-profile-v2">
        <img src="${asset(avatar)}" alt="">
        <div>
          <h2 id="userNickname">${esc(nickname)}</h2>
          <p id="userPhone">${esc(phone)}</p>
        </div>
      </div>
      <button id="btnUserLogoutMobile" class="user-logout-mini">退出</button>
    </section>

    <section class="user-stats user-stats-v2">
      <div><b id="userLevel">Lv.${esc(level)}</b><span>等级</span></div>
      <div><b id="userCoins">${esc(coins)}</b><span>金币</span></div>
      <div><b>0</b><span>关注</span></div>
    </section>

    <section class="user-menu user-menu-v2">
      <a href="#"><span class="menu-left"><span class="menu-icon">✉</span>我的私信</span><span>›</span></a>
      <a href="#"><span class="menu-left"><span class="menu-icon">★</span>我的关注</span><span>›</span></a>
      <a href="#"><span class="menu-left"><span class="menu-icon">🔒</span>账号与绑定</span><span>›</span></a>
      <a href="#"><span class="menu-left"><span class="menu-icon">i</span>关于海鸥直播</span><span>›</span></a>
    </section>
  </main>

  <main class="page-shell pc-only">
    <div class="container">
      <div class="user-pc-card">
        <div class="user-pc-head">
          <img src="${asset(avatar)}" alt="">
          <div>
            <h2 id="pcUserNickname">${esc(nickname)}</h2>
            <p id="pcUserPhone">${esc(phone)}</p>
          </div>
          <button id="btnUserLogoutPc" class="user-logout-btn">退出登录</button>
        </div>
        <div class="user-pc-stats">
          <div><b>Lv.${esc(level)}</b><span>等级</span></div>
          <div><b>${esc(coins)}</b><span>金币</span></div>
          <div><b>0</b><span>关注</span></div>
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

  if (!token) return;

  getUserInfo(token).then(function (res) {
    if (!res || !res.ok || !res.user) return;
    localStorage.setItem('user_profile', JSON.stringify(res.user));
  }).catch(function () {});
}
