/**
 * 海鸥直播 — 世界杯赛程表
 * 数据来源：assets/data/worldcup-schedule.json
 * 后续每天只维护 JSON 文件，不需要改 JS。
 */

import { href, esc } from './config.js';
import { mobileFloatAd, bindFloatBarEvents } from './ui.js';

function statusClass(status) {
  if (status === '直播中') return 'is-live';
  if (status === '已结束') return 'is-end';
  return 'is-wait';
}

function roomLink(roomId) {
  return roomId ? href('pages/room.html?id=' + roomId) : '#';
}

function matchAction(match) {
  if (!match.roomId) return '<span class="wc-no-room">待安排</span>';
  return `<a class="wc-watch-btn" href="${roomLink(match.roomId)}">进入直播间</a>`;
}

function renderPcSchedule(data) {
  const days = data.days || [];
  if (!days.length) {
    return '<div class="wc-empty">暂无赛程，请维护 worldcup-schedule.json</div>';
  }

  return days.map(day => `
    <section class="wc-day-card">
      <div class="wc-day-head">
        <h3>${esc(day.label || day.date || '')}</h3>
        <span>${esc(day.date || '')}</span>
      </div>
      <div class="wc-table">
        ${(day.matches || []).map(m => `
          <div class="wc-row">
            <div class="wc-time">${esc(m.time || '')}</div>
            <div class="wc-info">
              <div class="wc-league">${esc(m.league || '世界杯')}</div>
              <div class="wc-teams">
                <span>${esc(m.home || '')}</span>
                <b>VS</b>
                <span>${esc(m.away || '')}</span>
              </div>
            </div>
            <div class="wc-status ${statusClass(m.status)}">${esc(m.status || '未开始')}</div>
            <div class="wc-action">${matchAction(m)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `).join('');
}

function renderMobileSchedule(data) {
  const days = data.days || [];
  if (!days.length) {
    return '<div class="wc-empty">暂无赛程</div>';
  }

  return days.map(day => `
    <section class="m-wc-day">
      <div class="m-wc-day-title">${esc(day.label || day.date || '')}</div>
      ${(day.matches || []).map(m => `
        <a class="m-wc-card" href="${roomLink(m.roomId)}">
          <div class="m-wc-top">
            <span>${esc(m.time || '')}</span>
            <em class="${statusClass(m.status)}">${esc(m.status || '未开始')}</em>
          </div>
          <div class="m-wc-league">${esc(m.league || '世界杯')}</div>
          <div class="m-wc-teams">
            <span>${esc(m.home || '')}</span>
            <b>VS</b>
            <span>${esc(m.away || '')}</span>
          </div>
        </a>
      `).join('')}
    </section>
  `).join('');
}

async function loadWorldCupSchedule() {
  try {
    const res = await fetch(href('assets/data/worldcup-schedule.json') + '?t=' + Date.now());
    const data = await res.json();

    const pcBody = document.querySelector('#wcSchedulePc');
    const mobileBody = document.querySelector('#wcScheduleMobile');
    const pcUpdated = document.querySelector('#wcUpdatedAtPc');
    const mobileUpdated = document.querySelector('#wcUpdatedAtMobile');

    if (pcUpdated) pcUpdated.textContent = data.updatedAt ? ('更新时间：' + data.updatedAt) : '';
    if (mobileUpdated) mobileUpdated.textContent = data.updatedAt ? ('更新时间：' + data.updatedAt) : '';

    if (pcBody) pcBody.innerHTML = renderPcSchedule(data);
    if (mobileBody) mobileBody.innerHTML = renderMobileSchedule(data);
  } catch (e) {
    const pcBody = document.querySelector('#wcSchedulePc');
    const mobileBody = document.querySelector('#wcScheduleMobile');
    if (pcBody) pcBody.innerHTML = '<div class="wc-empty">赛程数据加载失败</div>';
    if (mobileBody) mobileBody.innerHTML = '<div class="wc-empty">赛程数据加载失败</div>';
  }
}

export function renderSchedule() {
  setTimeout(function () {
    bindFloatBarEvents();
    loadWorldCupSchedule();
  }, 80);

  return `
    <main class="page-shell pc-only">
      <div class="container">
        <div class="wc-page-head">
          <div>
            <h2>世界杯赛程表</h2>
            <p>按北京时间展示，后续每天维护 JSON 文件即可</p>
          </div>
          <span id="wcUpdatedAtPc"></span>
        </div>
        <div id="wcSchedulePc" class="wc-schedule-loading">赛程加载中...</div>
      </div>
    </main>

    <main class="mobile-page wc-mobile-page">
      <div class="m-section-title">世界杯赛程</div>
      <div id="wcUpdatedAtMobile" class="m-wc-updated"></div>
      <div id="wcScheduleMobile" class="wc-schedule-loading">赛程加载中...</div>
      ${mobileFloatAd()}
    </main>
  `;
}
