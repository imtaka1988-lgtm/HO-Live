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
import { initPlayerCoverFit } from './player-cover-fit.js';
import { initAdminReplayImport } from './admin-replay-import.js';
import { initAdminSiteMessages } from './admin-site-messages.js';
import { initAdminCommunityConfig } from './admin-community-config.js';
import { initAdminRoomSort } from './admin-room-sort.js';
import { initAdminCardCollapse } from './admin-card-collapse.js';
import { initUserMessageStatusFix } from './user-message-status-fix.js';

function loadMemberEntryCss() {
  if (document.querySelector('link[data-member-entry-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/css/member-entry.css';
  link.dataset.memberEntryStyle = '1';
  document.head.appendChild(link);
}

async function main() {
  const cfg = await loadConfig();
  state.cfg = cfg;
  loadMemberEntryCss();
  initAppIcons();
  applyTheme(cfg);
  initPlayerLineSwitcher();
  renderGlobalChrome();
  bootPage();
  initUserMessageStatusFix();
  initAdminReplayImport();
  initAdminSiteMessages();
  initAdminCommunityConfig();
  initAdminCardCollapse();
  initAdminRoomSort();
  initPlayerCoverFit();
  renderFooter();
  initMascot();
  initAdminNeutralLabels();
  initAdminInlineEditors();
  initAdminStreamLabels();
}

main().catch(err => console.error('海鸥直播启动失败：', err));
