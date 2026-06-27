/**
 * 懂球帝赛事资讯板块
 * 数据源：/api/articles（代理懂球帝公开接口）
 * 替代原"经典战役回顾"占位板块
 */

import { href, asset, esc } from './config.js';

const FILTERS = [
  ['toutiao', '头条'],
  ['yingchao', '英超'],
  ['xijia', '西甲'],
  ['yijia', '意甲'],
  ['dejia', '德甲'],
];

let articleItems = [];
let currentFilter = 'toutiao';

function replayTabsHtml() {
  return `<div class="replay-tabs" id="replayTabs">
    ${FILTERS.map(([key, text]) => `<button type="button" class="${key === 'toutiao' ? 'is-active' : ''}" data-filter="${key}">${text}</button>`).join('')}
  </div>`;
}

export function renderRoomReplaySection() {
  return `<main class="room-below room-replays-area" id="roomReplaysArea">
    <div class="container">
      <div class="replay-head">
        <div>
          <h2>懂球帝赛事资讯</h2>
          <p>懂球帝最新足球赛事报道与分析，数据实时同步。</p>
        </div>
        ${replayTabsHtml()}
      </div>
      <div class="replay-grid" id="roomReplayGrid"><div class="replay-loading">资讯加载中...</div></div>
    </div>
  </main>`;
}

export function renderReplaysPage() {
  return `<main class="page-shell replays-page">
    <div class="container">
      <div class="replays-page-hero">
        <span>懂球帝资讯</span>
        <h1>懂球帝赛事资讯</h1>
        <p>懂球帝最新足球赛事战报、分析与热点，数据实时同步更新。</p>
      </div>
      <div class="replay-head replay-head-page">
        <div>
          <h2>全部资讯</h2>
          <p>按联赛分类快速浏览。</p>
        </div>
        ${replayTabsHtml()}
      </div>
      <div class="replay-grid replay-grid-page" id="roomReplayGrid"><div class="replay-loading">资讯加载中...</div></div>
    </div>
  </main>`;
}

export function renderHomeReplaySection() {
  return `<section class="home-replays-section">
    <div class="section-head"><h2>懂球帝资讯</h2><a href="${href('pages/replays.html')}">查看更多 ›</a></div>
    <div class="replay-grid home-replay-grid" id="homeReplayGrid"><div class="replay-loading">资讯加载中...</div></div>
  </section>`;
}

function itemMatchesFilter(item, filter) {
  // 头条显示全部
  if (filter === 'toutiao') return true;
  // 按联赛名称匹配标题/摘要中的关键词
  const kwMap = {
    yingchao: ['英超', '英格兰', 'Premier'],
    xijia: ['西甲', '西班牙', '巴萨', '皇马', '马竞'],
    yijia: ['意甲', '意大利', '尤文', '国米', '米兰', '那不勒斯'],
    dejia: ['德甲', '德国', '拜仁', '多特'],
  };
  const keywords = kwMap[filter] || [];
  const text = ((item.title || '') + (item.description || '')).toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  // "2026-06-27T09:41:00" → "06-27 09:41"
  const m = String(dateStr).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
  return dateStr.slice(0, 16);
}

function replayCard(item) {
  const url = item.url || `https://www.dongqiudi.com/articles/${item.id}.html`;
  const cover = item.cover || item.thumb || 'assets/img/thumb-1.svg';
  const title = item.title || '赛事资讯';
  const desc = item.description || '点击查看详情';
  const time = formatTime(item.published_at);
  const comments = item.comments_total ? `${item.comments_total}评论` : '';

  return `<article class="replay-card" data-url="${esc(url)}" data-title="${esc(title)}">
    <div class="replay-cover">
      <img referrerpolicy="no-referrer" src="${asset(cover)}" alt="${esc(title)}" loading="lazy">
      ${time ? `<span class="replay-badge">${esc(time)}</span>` : ''}
      ${comments ? `<span class="replay-year">${esc(comments)}</span>` : ''}
    </div>
    <div class="replay-info">
      <div class="replay-title">${esc(title)}</div>
      <div class="replay-desc">${esc(desc)}</div>
      <button type="button" class="replay-btn">查看详情</button>
    </div>
  </article>`;
}

async function loadArticleItems(category) {
  try {
    const res = await fetch(href(`api/articles?category=${category}&limit=20`) + '&t=' + Date.now());
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.ok) return [];
    return data.articles || [];
  } catch (e) {
    console.error('加载懂球帝资讯失败:', e);
    return [];
  }
}

function bindReplayCards(root) {
  root.querySelectorAll('.replay-card').forEach(card => {
    card.addEventListener('click', function () {
      const url = this.dataset.url || '#';
      const title = this.dataset.title || '赛事资讯';
      if (!url || url === '#') {
        alert('该资讯暂不可用');
        return;
      }
      // 在新标签页打开懂球帝原文
      window.open(url, '_blank', 'noopener');
    });
  });
}

function renderArticleGrid(grid, options = {}) {
  if (!grid) return;

  const limit = options.limit || 0;
  let list = articleItems.filter(item => itemMatchesFilter(item, currentFilter));
  if (limit > 0) list = list.slice(0, limit);

  if (!list.length) {
    grid.innerHTML = '<div class="replay-empty">暂无该分类资讯，请稍后刷新</div>';
    return;
  }

  grid.innerHTML = list.map(replayCard).join('');
  bindReplayCards(grid);
}

async function refreshGrid(grid, category) {
  if (!grid) return;
  grid.innerHTML = '<div class="replay-loading">资讯加载中...</div>';
  articleItems = await loadArticleItems(category);
  renderArticleGrid(grid);
}

function bindReplayTabs(grid) {
  document.querySelectorAll('#replayTabs button').forEach(btn => {
    btn.addEventListener('click', function () {
      currentFilter = this.dataset.filter || 'toutiao';
      document.querySelectorAll('#replayTabs button').forEach(x => x.classList.remove('is-active'));
      this.classList.add('is-active');
      renderArticleGrid(grid);
    });
  });
}

export async function initRoomReplays() {
  if (!['room', 'replays'].includes(document.body.dataset.page)) return;
  const grid = document.querySelector('#roomReplayGrid');
  if (!grid) return;

  bindReplayTabs(grid);

  try {
    articleItems = await loadArticleItems('toutiao');
    renderArticleGrid(grid);
  } catch (e) {
    grid.innerHTML = '<div class="replay-empty">资讯暂时无法加载，请刷新重试</div>';
  }
}

export async function initHomeReplays() {
  const grid = document.querySelector('#homeReplayGrid');
  if (!grid) return;

  try {
    articleItems = await loadArticleItems('toutiao');
    renderArticleGrid(grid, { limit: 4 });
  } catch (e) {
    grid.innerHTML = '<div class="replay-empty">资讯暂时无法加载</div>';
  }
}
