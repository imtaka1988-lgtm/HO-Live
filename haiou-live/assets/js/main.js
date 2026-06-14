/**
 * 海鸥直播 V4.2 — 主入口
 *
 * 加载顺序：
 *   1. config.js——站点配置、主题注入、路径工具
 *   2. ui.js——全局外壳（头部导航、底部导航、手机标签栏）
 *   3. router.js——页面路由分发 → 渲染到 #app
 */

import { loadConfig, applyTheme, state } from './config.js';
import { renderGlobalChrome, renderFooter } from './ui.js';
import { bootPage } from './router.js';
import { initMascot } from './mascot.js';
import { initAdminNeutralLabels } from './admin-neutral-labels.js';
import { initAppIcons } from './app-icons.js';
import { initAdminInlineEditors } from './admin-inline-editor.js';
import { initAdminStreamLabels } from './admin-stream-labels.js';
import { initPlayerLineSwitcher } from './player-line-switcher.js';
import { initPlayerStreamTypeFix } from './player-stream-type-fix.js';
import { initPlayerCoverFit } from './player-cover-fit.js';
import { initAdminReplayImport } from './admin-replay-import.js';
import { initAdminSiteMessages } from './admin-site-messages.js';
import { initAdminCommunityConfig } from './admin-community-config.js';
import { initAdminRoomSort } from './admin-room-sort.js';
import { initAdminRoomInlineEditors } from './admin-room-inline-editors.js';
import { initAdminAnchorBundleNotice } from './admin-anchor-bundle-notice.js';
import { initAdminAnchorRoomPanel } from './admin-anchor-room-panel.js';
import { initAdminAnchorPanelToggle } from './admin-anchor-panel-toggle.js';
import { initAdminAnchorCopyLogin } from './admin-anchor-copy-login.js';
import { initAdminCardCollapse } from './admin-card-collapse.js';
import { initUserMessageStatusFix } from './user-message-status-fix.js';
import { initUserAvatarPreview } from './user-avatar-preview.js';
import { initUserLevelBenefits } from './user-level-benefits.js';
import { initMobileChatFocusFix } from './mobile-chat-focus.js';

function loadExtraCss() {
  const files = [
    ['member-entry-style', '/assets/css/member-entry.css'],
    ['mobile-chat-keyboard-style', '/assets/css/mobile-chat-keyboard.css']
  ];
  files.forEach(function (item) {
    if (document.querySelector('link[data-extra-style="' + item[0] + '"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = item[1];
    link.dataset.extraStyle = item[0];
    document.head.appendChild(link);
  });
}

function memberLevelFromProfile(profile) {
  if (profile && profile.level) return Math.max(1, Math.min(5, Number(profile.level) || 1));
  const exp = Number((profile && (profile.exp !== undefined ? profile.exp : profile.coins)) || 0);
  if (exp >= 600) return 5;
  if (exp >= 300) return 4;
  if (exp >= 150) return 3;
  if (exp >= 50) return 2;
  return 1;
}

function memberTitleByLevel(level) {
  if (level >= 5) return '荣耀会员';
  if (level >= 4) return '尊享会员';
  if (level >= 3) return '进阶会员';
  if (level >= 2) return '活跃会员';
  return '普通会员';
}

function normalizeAvatarUrl(value) {
  const raw = String(value || 'assets/img/avatar-default.svg').trim();
  if (!raw) return '/assets/img/avatar-default.svg';
  if (/^(https?:)?\/\//.test(raw) || raw.startsWith('/') || raw.startsWith('data:')) return raw;
  return '/' + raw.replace(/^\.\//, '').replace(/^\//, '');
}

function applyPcMemberLevel() {
  const link = document.querySelector('.pc-login a[href="/pages/user.html"]');
  if (!link || link.querySelector('.pc-member-lv')) return;
  let profile = {};
  try { profile = JSON.parse(localStorage.getItem('user_profile') || '{}'); } catch (e) {}
  const avatar = document.createElement('img');
  avatar.className = 'pc-member-mini-avatar';
  avatar.src = normalizeAvatarUrl(profile.avatar);
  avatar.alt = '';
  link.classList.add('has-pc-member-avatar');
  link.insertBefore(avatar, link.firstChild);
  const level = memberLevelFromProfile(profile);
  const badge = document.createElement('span');
  badge.className = 'pc-member-lv';
  badge.textContent = 'LV.' + level;
  const title = document.createElement('span');
  title.className = 'pc-member-title';
  title.textContent = memberTitleByLevel(level);
  link.appendChild(badge);
  link.appendChild(title);
}

async function main() {
  const cfg = await loadConfig();
  state.cfg = cfg;
  loadExtraCss();
  initMobileChatFocusFix();
  initAppIcons();
  applyTheme(cfg);
  initPlayerStreamTypeFix();
  initPlayerLineSwitcher();
  renderGlobalChrome();
  applyPcMemberLevel();
  bootPage();
  initUserLevelBenefits();
  initUserAvatarPreview();
  initUserMessageStatusFix();
  initAdminReplayImport();
  initAdminSiteMessages();
  initAdminCommunityConfig();
  initAdminCardCollapse();
  initAdminRoomSort();
  initAdminRoomInlineEditors();
  initAdminAnchorBundleNotice();
  initAdminAnchorPanelToggle();
  initAdminAnchorRoomPanel();
  initAdminAnchorCopyLogin();
  initPlayerCoverFit();
  renderFooter();
  initMascot();
  initAdminNeutralLabels();
  initAdminInlineEditors();
  initAdminStreamLabels();
}

main().catch(err => console.error('海鸥直播启动失败：', err));
