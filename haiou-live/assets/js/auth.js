/**
 * 海鸥直播 — 普通用户登录 / 注册模块
 */

import { href, esc } from './config.js';
import { registerUser, loginUser } from './api.js';

function isRegisterMode() {
  return new URLSearchParams(location.search).get('register') === '1';
}

export function getToken() {
  return localStorage.getItem('token') || null;
}

export function setToken(t) {
  localStorage.setItem('token', t);
}

export function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('user_profile');
}

export function setUserProfile(user) {
  localStorage.setItem('user_profile', JSON.stringify(user || {}));
}

export function getUserProfile() {
  try {
    return JSON.parse(localStorage.getItem('user_profile') || '{}');
  } catch {
    return {};
  }
}

/** 渲染登录/注册页 */
export function renderLogin() {
  const reg = isRegisterMode();
  return `
    <main class="simple-page">
      <div class="login-box">
        <a class="back-link" href="${href('index.html')}">‹</a>
        <h1>${reg ? '快速注册' : '登录'}</h1>
        <p>注册登录即代表你已同意 <a href="#">《用户协议》</a></p>

        <form id="authForm">
          <div class="form-line">
            <strong>+86⌄</strong>
            <input id="authPhone" placeholder="请输入手机号" inputmode="tel" autocomplete="tel">
          </div>

          ${reg ? `
          <div class="form-line">
            <input id="authNickname" placeholder="请输入昵称，可不填" autocomplete="nickname">
          </div>` : ''}

          <div class="form-line">
            <input id="authPassword" placeholder="请输入6-16位登录密码" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}">
            <span>◎</span>
          </div>

          <button class="login-submit" id="btnUserAuthSubmit" type="submit">${reg ? '注册并登录' : '登录'}</button>

          <div id="authMessage" style="margin-top:12px;font-size:13px;color:#ef4444;min-height:18px;"></div>

          <div class="login-actions">
            <a href="#">忘记密码</a>
            <a id="authSwitchLink" href="${href(reg ? 'pages/login.html' : 'pages/login.html?register=1')}">${reg ? '已有账号，去登录' : '快速注册'}</a>
          </div>
        </form>
      </div>
    </main>
  `;
}

/** 绑定登录/注册事件 */
export function bindLoginEvents() {
  const form = document.querySelector('#authForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const reg = isRegisterMode();
    const phone = (document.querySelector('#authPhone')?.value || '').trim();
    const password = document.querySelector('#authPassword')?.value || '';
    const nickname = (document.querySelector('#authNickname')?.value || '').trim();
    const msg = document.querySelector('#authMessage');
    const btn = document.querySelector('#btnUserAuthSubmit');

    if (!phone) {
      if (msg) msg.textContent = '请输入手机号';
      return;
    }

    if (password.length < 6 || password.length > 16) {
      if (msg) msg.textContent = '密码需要 6-16 位';
      return;
    }

    if (msg) msg.textContent = reg ? '注册中...' : '登录中...';
    if (btn) btn.disabled = true;

    const result = reg
      ? await registerUser(phone, password, nickname)
      : await loginUser(phone, password);

    if (btn) btn.disabled = false;

    if (!result || !result.ok) {
      if (msg) msg.textContent = (result && result.error) ? result.error : '操作失败，请稍后重试';
      return;
    }

    setToken(result.token);
    setUserProfile(result.user);

    if (msg) {
      msg.style.color = '#16a34a';
      msg.textContent = '登录成功，正在进入我的页面...';
    }

    setTimeout(function () {
      location.href = href('pages/user.html');
    }, 300);
  });
}
