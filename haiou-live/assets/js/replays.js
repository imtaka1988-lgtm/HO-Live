/**
 * 经典战役回顾板块
 * 支持占位、外链和 iframe/B站站内弹窗播放。
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

function replayTabsHtml() {
  return `<div class="replay-tabs" id="replayTabs">
    ${FILTERS.map(([key, text]) => `<button type="button" class="${key === 'all' ? 'is-active' : ''}" data-filter="${key}">${text}</button>`).join('')}
  </div>`;
}

export function renderRoomReplaySection() {
  return `<main class="room-below room-replays-area" id="roomReplaysArea">
    <div class="container">
      <div class="replay-head">
        <div>
          <h2>经典战役回顾</h2>
          <p>精选足球、篮球经典比赛回顾，真实片源后续接入。</p>
        </div>
        ${replayTabsHtml()}
      </div>
      <div class="replay-grid" id="roomReplayGrid"><div class="replay-loading">经典回顾加载中...</div></div>
    </div>
  </main>`;
}

export function renderReplaysPage() {
  return `<main class="page-shell replays-page">
    <div class="container">
      <div class="replays-page-hero">
        <span>赛事回放</span>
        <h1>经典战役回顾</h1>
        <p>精选足球、篮球精彩比赛集锦与经典回放，随时重温高光瞬间。</p>
      </div>
      <div class="replay-head replay-head-page">
        <div>
          <h2>全部回放</h2>
          <p>按分类快速浏览经典赛事。</p>
        </div>
        ${replayTabsHtml()}
      </div>
      <div class="replay-grid replay-grid-page" id="roomReplayGrid"><div class="replay-loading">经典回顾加载中...</div></div>
    </div>
  </main>`;
}

export function renderHomeReplaySection() {
  return `<section class="home-replays-section">
    <div class="section-head"><h2>赛事回放</h2><a href="${href('pages/replays.html')}">查看更多 ›</a></div>
    <div class="replay-grid home-replay-grid" id="homeReplayGrid"><div class="replay-loading">经典回顾加载中...</div></div>
  </section>`;
}

function itemMatchesFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'worldcup') return String(item.tag || '').includes('世界杯');
  if (filter === 'nba') return String(item.tag || '').toUpperCase().includes('NBA');
  return item.sport === filter;
}

function replayCard(item) {
  const embedUrl = item.embedUrl || '';
  const isIframe = ['iframe', 'bilibili', 'xigua'].includes(String(item.sourceType || '').toLowerCase());
  const isReady = (item.url && item.url !== '#') || (isIframe && embedUrl);
  const btnText = isReady ? (item.status || '观看回顾') : (item.status || '等待片源');
  const badge = item.tag || (item.sport === 'basketball' ? '篮球' : '足球');

  return `<article class="replay-card ${isReady ? '' : 'is-placeholder'}" data-url="${esc(item.url || '#')}" data-embed-url="${esc(embedUrl)}" data-source-type="${esc(item.sourceType || '')}" data-title="${esc(item.title || '经典战役')}">
    <div class="replay-cover">
      <img referrerpolicy="no-referrer" src="${asset(item.cover || 'assets/img/thumb-1.svg')}" alt="${esc(item.title || '')}">
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

async function fetchReplayFile(path) {
  try {
    const res = await fetch(href(path) + '?t=' + Date.now());
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

async function loadReplayItems() {
  if (replayItems.length) return replayItems;

  const baseItems = await fetchReplayFile('assets/data/replays.json');
  const localItems = await fetchReplayFile('assets/data/replays.local.json');
  replayItems = localItems.concat(baseItems)
    .filter(item => item && item.enabled !== false)
    .sort((a, b) => (a.sort || 99) - (b.sort || 99));
  return replayItems;
}

function closeReplayModal() {
  const modal = document.querySelector('#replayModal');
  if (modal) modal.remove();
  document.body.classList.remove('replay-modal-open');
}

function openReplayModal(title, embedUrl) {
  closeReplayModal();
  document.body.classList.add('replay-modal-open');
  const modal = document.createElement('div');
  modal.id = 'replayModal';
  modal.className = 'replay-modal-overlay';
  modal.innerHTML = `<div class="replay-modal-box">
    <div class="replay-modal-head"><b>${esc(title || '赛事回放')}</b><button type="button" id="replayModalClose">×</button></div>
    <div class="replay-iframe-wrap"><iframe src="${esc(embedUrl)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen="true" scrolling="no" frameborder="0" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeReplayModal();
  });
  const closeBtn = modal.querySelector('#replayModalClose');
  if (closeBtn) closeBtn.addEventListener('click', closeReplayModal);
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      closeReplayModal();
      document.removeEventListener('keydown', onKey);
    }
  });
}

function bindReplayCards(root) {
  root.querySelectorAll('.replay-card').forEach(card => {
    card.addEventListener('click', function () {
      const url = this.dataset.url || '#';
      const embedUrl = this.dataset.embedUrl || '';
      const sourceType = String(this.dataset.sourceType || '').toLowerCase();
      const title = this.dataset.title || '赛事回放';
      const isIframe = ['iframe', 'bilibili', 'xigua'].includes(sourceType);

      if (isIframe && embedUrl) {
        openReplayModal(title, embedUrl);
        return;
      }

      if (!url || url === '#') {
        alert('该经典回顾片源稍后接入');
        return;
      }
      window.open(url, '_blank', 'noopener');
    });
  });
}

function renderReplayGrid(grid, options = {}) {
  if (!grid) return;

  const limit = options.limit || 0;
  let list = replayItems.filter(item => itemMatchesFilter(item, currentFilter));
  if (limit > 0) list = list.slice(0, limit);

  if (!list.length) {
    grid.innerHTML = '<div class="replay-empty">暂无该分类回顾</div>';
    return;
  }

  grid.innerHTML = list.map(replayCard).join('');
  bindReplayCards(grid);
}

function bindReplayTabs(grid) {
  document.querySelectorAll('#replayTabs button').forEach(btn => {
    btn.addEventListener('click', function () {
      currentFilter = this.dataset.filter || 'all';
      document.querySelectorAll('#replayTabs button').forEach(x => x.classList.remove('is-active'));
      this.classList.add('is-active');
      renderReplayGrid(grid);
    });
  });
}

export async function initRoomReplays() {
  if (!['room', 'replays'].includes(document.body.dataset.page)) return;
  const grid = document.querySelector('#roomReplayGrid');
  if (!grid) return;

  bindReplayTabs(grid);

  try {
    await loadReplayItems();
    renderReplayGrid(grid);
  } catch (e) {
    grid.innerHTML = '<div class="replay-empty">经典回顾暂时无法加载</div>';
  }
}

export async function initHomeReplays() {
  const grid = document.querySelector('#homeReplayGrid');
  if (!grid) return;

  try {
    await loadReplayItems();
    renderReplayGrid(grid, { limit: 4 });
  } catch (e) {
    grid.innerHTML = '<div class="replay-empty">经典回顾暂时无法加载</div>';
  }
}
