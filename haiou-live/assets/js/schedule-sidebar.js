/**
 * 赛程侧边栏 — 全部直播页右侧面板
 * 数据源：GET /api/schedule（ESPN 15天赛程）
 */
import { href, esc } from './config.js';

const SPORT_ICONS = {
  '世界杯': '🏆', '欧冠': '⭐', '英超': '🦁', '西甲': '👑',
  '德甲': '⚡', '意甲': '🍝', '法甲': '🥐', '欧联': '🔵',
  'NBA': '🏀', 'WNBA': '🏀',
};

function statusBadge(e) {
  if (e.status === 'STATUS_IN_PROGRESS') {
    return `<span class="sch-live-dot"></span><span class="sch-live-text">LIVE ${e.detail || ''}</span>`;
  }
  if (e.status === 'STATUS_FINAL') {
    return `<span class="sch-final">完赛</span>`;
  }
  return `<span class="sch-time">${esc(e.time || '--:--')}</span>`;
}

function matchRow(m) {
  const icon = SPORT_ICONS[m.league] || '📅';
  return `<div class="sch-match">
    <div class="sch-match-league">${icon} ${esc(m.league)}</div>
    <div class="sch-match-teams">
      <span class="sch-home">${esc(m.home)}</span>
      <span class="sch-vs">vs</span>
      <span class="sch-away">${esc(m.away)}</span>
    </div>
    <div class="sch-match-meta">${statusBadge(m)}</div>
  </div>`;
}

function daySection(day) {
  const label = day.isToday ? '今天' : day.date.slice(5); // "06-28"
  const badge = day.isToday ? '<span class="sch-today-badge">今天</span>' : '';
  return `<div class="sch-day">
    <div class="sch-day-head">
      <span class="sch-day-label">${label}</span>
      ${badge}
      <span class="sch-day-count">${day.count}场</span>
    </div>
    ${day.matches.map(matchRow).join('')}
  </div>`;
}

function loadingHtml() {
  return `<div class="sch-loading">
    <div class="sch-loading-spin"></div>
    <span>赛程加载中...</span>
  </div>`;
}

function errorHtml() {
  return `<div class="sch-error">赛程暂不可用</div>`;
}

export function renderScheduleSidebar() {
  return `<aside class="schedule-sidebar" id="scheduleSidebar">
    <div class="sch-header">
      <h3>📅 赛事赛程</h3>
      <span class="sch-subtitle">近15天</span>
    </div>
    <div class="sch-body" id="scheduleBody">
      ${loadingHtml()}
    </div>
  </aside>`;
}

export function renderLiveWithSidebar(roomsHtml, tabsHtml) {
  return `<div class="live-with-sidebar">
    <div class="live-main">
      ${tabsHtml}
      <div class="live-grid">${roomsHtml}</div>
    </div>
    ${renderScheduleSidebar()}
  </div>`;
}

export async function initScheduleSidebar() {
  const body = document.querySelector('#scheduleBody');
  if (!body) return;

  try {
    const res = await fetch(href('api/schedule'));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.ok || !data.days) throw new Error('Invalid data');

    if (!data.days.length) {
      body.innerHTML = '<div class="sch-empty">近期暂无赛程<br><small>联赛休赛期</small></div>';
      return;
    }

    // 更新头部统计
    const liveCount = data.live || 0;
    const sub = document.querySelector('.sch-subtitle');
    if (sub && liveCount > 0) {
      sub.innerHTML = `近15天 · <b style="color:#e53e3e">${liveCount}场进行中</b>`;
    }

    body.innerHTML = data.days.map(daySection).join('');
  } catch (e) {
    body.innerHTML = errorHtml();
  }
}
