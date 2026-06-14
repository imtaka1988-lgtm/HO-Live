/**
 * 直播页经典战役回顾占位板块
 * 第一版只展示卡片，不接真实播放源。
 */

import { href, asset, esc } from './config.js';

const FILTERS = [
  ['all', '全部'],
  ['football', '足球'],
  ['basketball', '篮球'],
  ['worldcup', '世界杯'],
  ['nba', 'NBA']
];

let replayItems = [];
let currentFilter = 'all';

export function renderRoomReplaySection() {
  return `<main class="room-below room-replays-area" id="roomReplaysArea">
    <div class="container">
      <div class="replay-head">
        <div>
          <h2>经典战役回顾</h2>
          <p>精选足球、篮球经典比赛回顾，真实片源后续接入。</p>
        </div>
        <div class="replay-tabs" id="replayTabs">
          ${FILTERS.map(([key, text]) => `<button type="button" class="${key === 'all' ? 'is-active' : ''}" data-filter="${key}">${text}</button>`).join('')}
        </div>
      </div>
      <div class="replay-grid" id="roomReplayGrid"><div class="replay-loading">经典回顾加载中...</div></div>
    </div>
  </main>`;
}

function itemMatchesFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'worldcup') return String(item.tag || '').includes('世界杯');
  if (filter === 'nba') return String(item.tag || '').toUpperCase().includes('NBA');
  return item.sport === filter;
}

function replayCard(item) {
  const isReady = item.url && item.url !== '#';
  const btnText = isReady ? '观看回顾' : (item.status || '等待片源');
  const badge = item.tag || (item.sport === 'basketball' ? '篮球' : '足球');

  return `<article class="replay-card ${isReady ? '' : 'is-placeholder'}" data-url="${esc(item.url || '#')}">
    <div class="replay-cover">
      <img src="${asset(item.cover || 'assets/img/thumb-1.svg')}" alt="${esc(item.title || '')}">
      <span class="replay-badge">${esc(badge)}</span>
      <span class="replay-year">${esc(item.year || '经典')}</span>
    </div>
    <div class="replay-info">
      <div class="replay-title">${esc(item.title || '经典战役')}</div>
      <div class="replay-desc">${esc(item.desc || '精彩比赛回顾，片源后续接入。')}</div>
      <button type="button" class="replay-btn">${esc(btnText)}</button>
    </div>
  </article>`;
}

function renderReplayGrid() {
  const grid = document.querySelector('#roomReplayGrid');
  if (!grid) return;

  const list = replayItems.filter(item => itemMatchesFilter(item, currentFilter));
  if (!list.length) {
    grid.innerHTML = '<div class="replay-empty">暂无该分类回顾</div>';
    return;
  }

  grid.innerHTML = list.map(replayCard).join('');

  grid.querySelectorAll('.replay-card').forEach(card => {
    card.addEventListener('click', function () {
      const url = this.dataset.url || '#';
      if (!url || url === '#') {
        alert('该经典回顾片源稍后接入');
        return;
      }
      window.open(url, '_blank', 'noopener');
    });
  });
}

function bindReplayTabs() {
  document.querySelectorAll('#replayTabs button').forEach(btn => {
    btn.addEventListener('click', function () {
      currentFilter = this.dataset.filter || 'all';
      document.querySelectorAll('#replayTabs button').forEach(x => x.classList.remove('is-active'));
      this.classList.add('is-active');
      renderReplayGrid();
    });
  });
}

export async function initRoomReplays() {
  if (document.body.dataset.page !== 'room') return;
  const grid = document.querySelector('#roomReplayGrid');
  if (!grid) return;

  bindReplayTabs();

  try {
    const res = await fetch(href('assets/data/replays.json') + '?t=' + Date.now());
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    replayItems = (Array.isArray(data) ? data : [])
      .filter(item => item && item.enabled !== false)
      .sort((a, b) => (a.sort || 99) - (b.sort || 99));
    renderReplayGrid();
  } catch (e) {
    grid.innerHTML = '<div class="replay-empty">经典回顾暂时无法加载</div>';
  }
}
