/**
 * 体育资讯板块
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

// 每个分类独立缓存
let articleCache = {};
let currentFilter = 'toutiao';
const ARTICLES_PER_CAT = 20;

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
          <h2>体育资讯</h2>
          <p>最新足球赛事报道与分析，实时更新。</p>
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
        <span>赛事资讯</span>
        <h1>体育资讯</h1>
        <p>最新足球赛事战报、分析与热点，实时更新。</p>
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
    <div class="section-head"><h2>体育资讯</h2><a href="${href('pages/replays.html')}">查看更多 ›</a></div>
    <div class="replay-grid home-replay-grid" id="homeReplayGrid"><div class="replay-loading">资讯加载中...</div></div>
  </section>`;
}

function itemMatchesFilter(item, filter) {
  // 不再客户端过滤，只分不同分类，全部展示
  return true;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const m = String(dateStr).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
  return dateStr.slice(0, 16);
}

function replayCard(item) {
  const cover = item.cover || item.thumb || 'assets/img/thumb-1.svg';
  const title = item.title || '赛事资讯';
  const desc = item.description || '点击查看详情';
  const time = formatTime(item.published_at);
  const comments = item.comments_total ? `${item.comments_total}评论` : '';

  return `<article class="replay-card" data-id="${item.id}" data-title="${esc(title)}">
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

async function loadArticleItems(category, forceRefresh) {
  // 使用缓存，避免重复请求
  if (!forceRefresh && articleCache[category] && articleCache[category].length) {
    return articleCache[category];
  }
  try {
    const res = await fetch(href(`api/articles?category=${category}&limit=${ARTICLES_PER_CAT}`) + '&t=' + Date.now());
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.ok) return [];
    const articles = data.articles || [];
    articleCache[category] = articles;
    return articles;
  } catch (e) {
    console.error('加载体育资讯失败:', e);
    return [];
  }
}

// ===================== 文章详情弹窗（本站内展示） =====================

function closeArticleModal() {
  const modal = document.querySelector('#articleModal');
  if (modal) modal.remove();
  document.body.classList.remove('replay-modal-open');
}

async function openArticleModal(articleId, title) {
  closeArticleModal();
  document.body.classList.add('replay-modal-open');

  const modal = document.createElement('div');
  modal.id = 'articleModal';
  modal.className = 'replay-modal-overlay';
  modal.innerHTML = `<div class="replay-modal-box article-detail-box">
    <div class="replay-modal-head">
      <b>${esc(title || '加载中...')}</b>
      <button type="button" id="articleModalClose">×</button>
    </div>
    <div class="article-detail-body" id="articleDetailBody">
      <div class="replay-loading" style="padding:40px;text-align:center;">文章加载中...</div>
    </div>
  </div>`;

  document.body.appendChild(modal);

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeArticleModal();
  });
  modal.querySelector('#articleModalClose').addEventListener('click', closeArticleModal);
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { closeArticleModal(); document.removeEventListener('keydown', onKey); }
  });

  // 异步加载文章内容
  try {
    const res = await fetch(href(`api/articles/${articleId}`));
    if (!res.ok) throw new Error('请求失败');
    const data = await res.json();
    if (!data.ok || !data.article) throw new Error('无数据');

    const article = data.article;
    const body = modal.querySelector('#articleDetailBody');
    const titleEl = modal.querySelector('.replay-modal-head b');

    if (titleEl && article.title) titleEl.textContent = article.title;

    // 渲染正文（保留换行）
    const paragraphs = (article.content || '').split('\n').filter(p => p.trim());
    const imagesHtml = (article.images || []).slice(0, 5).map(
      img => `<img src="${esc(img)}" alt="" style="max-width:100%;margin:12px 0;border-radius:8px;" loading="lazy" referrerpolicy="no-referrer">`
    ).join('');

    body.innerHTML = `
      <div class="article-meta">
        ${article.published_at ? `<span>${formatTime(article.published_at)}</span>` : ''}
        <span>来源：懂球帝</span>
      </div>
      ${imagesHtml}
      <div class="article-text">
        ${paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}
      </div>
      ${imagesHtml ? '' : imagesHtml}
    `;
  } catch (e) {
    const body = modal.querySelector('#articleDetailBody');
    if (body) body.innerHTML = '<div class="replay-empty" style="padding:40px;text-align:center;">文章加载失败，请稍后重试</div>';
  }
}

function bindReplayCards(root) {
  root.querySelectorAll('.replay-card').forEach(card => {
    card.addEventListener('click', function () {
      const id = this.dataset.id;
      const title = this.dataset.title || '体育资讯';
      if (!id) {
        alert('该资讯暂不可用');
        return;
      }
      // 本站内弹窗展示文章
      openArticleModal(id, title);
    });
  });
}

async function renderArticleGrid(grid, options = {}) {
  if (!grid) return;

  const limit = options.limit || 0;

  // 按需加载当前分类（如果缓存没有则从API获取）
  grid.innerHTML = '<div class="replay-loading">资讯加载中...</div>';
  const items = await loadArticleItems(currentFilter);

  let list = items;
  if (limit > 0) list = list.slice(0, limit);

  if (!list.length) {
    grid.innerHTML = '<div class="replay-empty">暂无该分类资讯，请稍后刷新</div>';
    return;
  }

  grid.innerHTML = list.map(replayCard).join('');
  bindReplayCards(grid);
}

function bindReplayTabs(grid) {
  document.querySelectorAll('#replayTabs button').forEach(btn => {
    btn.addEventListener('click', async function () {
      currentFilter = this.dataset.filter || 'toutiao';
      document.querySelectorAll('#replayTabs button').forEach(x => x.classList.remove('is-active'));
      this.classList.add('is-active');
      await renderArticleGrid(grid);
    });
  });
}

export async function initRoomReplays() {
  if (!['room', 'replays'].includes(document.body.dataset.page)) return;
  const grid = document.querySelector('#roomReplayGrid');
  if (!grid) return;

  bindReplayTabs(grid);

  try {
    await renderArticleGrid(grid);
  } catch (e) {
    grid.innerHTML = '<div class="replay-empty">资讯暂时无法加载，请刷新重试</div>';
  }
}

export async function initHomeReplays() {
  const grid = document.querySelector('#homeReplayGrid');
  if (!grid) return;

  try {
    // 首页预加载头条
    currentFilter = 'toutiao';
    await renderArticleGrid(grid, { limit: 6 });
    // 后台预加载其他分类
    ['yingchao', 'xijia', 'yijia', 'dejia'].forEach(cat => loadArticleItems(cat));
  } catch (e) {
    grid.innerHTML = '<div class="replay-empty">资讯暂时无法加载</div>';
  }
}
