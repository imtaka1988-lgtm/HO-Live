/**
 * PC 右上角会员入口美化
 * 独立增强，不改主 UI 渲染，失败也不影响页面。
 */

import { asset, esc } from './config.js';

function readProfile() {
  try { return JSON.parse(localStorage.getItem('user_profile') || '{}'); } catch (e) { return {}; }
}

function levelFromProfile(profile) {
  if (profile && profile.level) return Math.max(1, Math.min(5, Number(profile.level) || 1));
  const exp = Number((profile && (profile.exp !== undefined ? profile.exp : profile.coins)) || 0);
  if (exp >= 600) return 5;
  if (exp >= 300) return 4;
  if (exp >= 150) return 3;
  if (exp >= 50) return 2;
  return 1;
}

function titleByLevel(level) {
  if (level >= 5) return '荣耀会员';
  if (level >= 4) return '尊享会员';
  if (level >= 3) return '进阶会员';
  if (level >= 2) return '活跃会员';
  return '普通会员';
}

function injectStyle() {
  if (document.querySelector('#pcUserEntryPolishStyle')) return;
  const style = document.createElement('style');
  style.id = 'pcUserEntryPolishStyle';
  style.textContent = `
    .pc-login.pc-member-wrap {
      flex: 0 0 260px;
      justify-content: flex-end;
    }
    .pc-member-entry {
      display: flex !important;
      align-items: center;
      gap: 9px;
      max-width: 245px;
      padding: 7px 10px 7px 8px;
      border-radius: 999px;
      background: linear-gradient(135deg,#101827,#3b260b 56%,#111827);
      color: #fff !important;
      box-shadow: 0 10px 28px rgba(249,115,22,.24), inset 0 0 0 1px rgba(250,204,21,.30);
      overflow: hidden;
      transform: translateZ(0);
    }
    .pc-member-entry:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 32px rgba(249,115,22,.32), inset 0 0 0 1px rgba(250,204,21,.42);
    }
    .pc-member-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      padding: 2px;
      background: linear-gradient(135deg,#fde047,#f97316);
      flex: 0 0 auto;
    }
    .pc-member-avatar img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      background: #fff;
    }
    .pc-member-info {
      min-width: 0;
      display: flex;
      flex-direction: column;
      line-height: 1.1;
      text-align: left;
    }
    .pc-member-name {
      max-width: 98px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #fff;
      font-size: 13px;
      font-weight: 900;
    }
    .pc-member-meta {
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 5px;
      color: #fde68a;
      font-size: 11px;
      font-weight: 900;
      white-space: nowrap;
    }
    .pc-member-level {
      border-radius: 999px;
      padding: 2px 6px;
      background: linear-gradient(135deg,#facc15,#f97316);
      color: #111827;
      font-style: normal;
      font-weight: 1000;
    }
    .pc-member-arrow {
      margin-left: auto;
      color: #fde68a;
      font-style: normal;
      font-size: 18px;
      line-height: 1;
    }
  `;
  document.head.appendChild(style);
}

export function initPcUserEntryPolish() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const wrap = document.querySelector('.pc-login');
    const link = wrap && wrap.querySelector('a[href$="/pages/user.html"],a[href="/pages/user.html"]');
    if (!wrap || !link || link.dataset.pcMemberPolished === '1') return;

    const profile = readProfile();
    const name = profile.nickname || link.textContent || '海鸥会员';
    const avatar = profile.avatar || 'assets/img/avatar-default.svg';
    const level = levelFromProfile(profile);
    const title = titleByLevel(level);

    injectStyle();
    wrap.classList.add('pc-member-wrap');
    link.classList.add('pc-member-entry');
    link.dataset.pcMemberPolished = '1';
    link.innerHTML = `<span class="pc-member-avatar"><img src="${asset(avatar)}" alt=""></span>
      <span class="pc-member-info"><b class="pc-member-name">${esc(name)}</b><small class="pc-member-meta"><em class="pc-member-level">LV.${esc(level)}</em>${esc(title)}</small></span>
      <i class="pc-member-arrow">›</i>`;
  } catch (e) {
    console.warn('[pc-user-entry-polish] skipped', e.message);
  }
}
