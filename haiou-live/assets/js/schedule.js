/**
 * 海鸥直播 — 赛事赛程页
 * 数据来源：GET /api/schedule（ESPN 15天赛程）
 */

import { href, esc } from './config.js';
import { mobileFloatAd, bindFloatBarEvents } from './ui.js';

function statusBadge(m) {
  if (m.status === 'STATUS_IN_PROGRESS') {
    return `<span class="wc-status is-live">🔴 LIVE ${esc(m.detail || '')}</span>`;
  }
  // ESPN 足球用 STATUS_FULL_TIME，篮球用 STATUS_FINAL，还有其他变体
  if (m.status === 'STATUS_FINAL' || m.status === 'STATUS_FULL_TIME' || m.status === 'STATUS_FULL') {
    return `<span class="wc-status is-end">完赛</span>`;
  }
  if (m.status === 'STATUS_HALFTIME') {
    return `<span class="wc-status is-live">⏸️ 中场</span>`;
  }
  return `<span class="wc-status is-wait">${esc(m.time || '--:--')}</span>`;
}

function renderPcSchedule(days) {
  if (!days || !days.length) {
    return '<div class="wc-empty">近期暂无赛程，联赛休赛期</div>';
  }

  return days.map(day => `
    <section class="wc-day-card">
      <div class="wc-day-head">
        <h3>${day.isToday ? '🔥 今天' : esc(day.date)}</h3>
        <span>${esc(day.count)} 场比赛</span>
      </div>
      <div class="wc-grid">
        ${(day.matches || []).map(m => `
          <div class="wc-card">
            <div class="wc-card-league">${esc(m.league)}</div>
            <div class="wc-card-teams">
              <span>${esc(m.home)}</span>
              <b>VS</b>
              <span>${esc(m.away)}</span>
            </div>
            <div class="wc-card-meta">
              <span>${statusBadge(m)}</span>
              <span>${esc(m.venue || '')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `).join('');
}

function renderMobileSchedule(days) {
  if (!days || !days.length) {
    return '<div class="wc-empty">近期暂无赛程</div>';
  }

  return days.map(day => `
    <section class="m-wc-day">
      <div class="m-wc-day-title">${day.isToday ? '🔥 今天' : esc(day.date)} · ${esc(day.count)}场</div>
      ${(day.matches || []).map(m => `
        <div class="m-wc-card">
          <div class="m-wc-top">
            <span>${esc(m.league)}</span>
            ${statusBadge(m)}
          </div>
          <div class="m-wc-teams">
            <span>${esc(m.home)}</span>
            <b>VS</b>
            <span>${esc(m.away)}</span>
          </div>
        </div>
      `).join('')}
    </section>
  `).join('');
}

async function loadSchedule() {
  try {
    const res = await fetch(href('api/schedule') + '?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error('Invalid');

    const days = data.days || [];
    const total = data.total || 0;
    const liveCount = data.live || 0;

    // 更新统计
    const pcTotal = document.querySelector('#wcTotalPc');
    const pcLive = document.querySelector('#wcLivePc');
    const mobileTotal = document.querySelector('#wcTotalMobile');
    if (pcTotal) pcTotal.textContent = total + ' 场';
    if (pcLive && liveCount > 0) pcLive.innerHTML = `<span class="wc-live-dot"></span>${liveCount} 场进行中`;
    if (mobileTotal) mobileTotal.textContent = '共 ' + total + ' 场 · ' + (data.updated || '').slice(0, 16);

    const pcBody = document.querySelector('#wcSchedulePc');
    const mobileBody = document.querySelector('#wcScheduleMobile');
    if (pcBody) pcBody.innerHTML = renderPcSchedule(days);
    if (mobileBody) mobileBody.innerHTML = renderMobileSchedule(days);
  } catch (e) {
    const pcBody = document.querySelector('#wcSchedulePc');
    const mobileBody = document.querySelector('#wcScheduleMobile');
    const msg = '<div class="wc-empty">赛程数据加载失败，请刷新重试</div>';
    if (pcBody) pcBody.innerHTML = msg;
    if (mobileBody) mobileBody.innerHTML = msg;
  }
}

export function renderSchedule() {
  setTimeout(function () {
    bindFloatBarEvents();
    loadSchedule();
  }, 80);

  return `
    <main class="page-shell pc-only">
      <div class="container">
        <div class="wc-page-head">
          <div>
            <h2>赛事赛程</h2>
            <p>覆盖世界杯、欧冠、五大联赛、NBA/WNBA，数据实时更新</p>
          </div>
          <div class="wc-stats">
            <span id="wcTotalPc">加载中...</span>
            <span id="wcLivePc"></span>
          </div>
        </div>
        <div id="wcSchedulePc" class="wc-schedule-loading">赛程加载中...</div>
      </div>
    </main>

    <main class="mobile-page wc-mobile-page">
      <div class="m-section-title">赛事赛程 <span id="wcTotalMobile"></span></div>
      <div id="wcScheduleMobile" class="wc-schedule-loading">赛程加载中...</div>
      ${mobileFloatAd()}
    </main>
  `;
}
