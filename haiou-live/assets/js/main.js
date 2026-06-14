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

async function main() {
  const cfg = await loadConfig();
  state.cfg = cfg;
  initAppIcons();
  applyTheme(cfg);
  initPlayerLineSwitcher();
  renderGlobalChrome();
  bootPage();
  renderFooter();
  initMascot();
  initAdminNeutralLabels();
  initAdminInlineEditors();
  initAdminStreamLabels();
}

main().catch(err => console.error('海鸥直播启动失败：', err));
