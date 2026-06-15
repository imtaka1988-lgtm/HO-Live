/**
 * 后台卡片折叠系统
 * 功能越来越多后，保持后台页面清爽。
 */

const STORAGE_PREFIX = 'admin_card_collapsed_';
const DEFAULT_OPEN_TITLES = ['管理后台已登录', '房间列表', '会员管理'];
const SKIP_CARD_SELECTORS = ['.admin-replay-import-card', '#adminMemberCard'];

function injectStyle() {
  if (document.querySelector('#adminCardCollapseStyle')) return;
  const style = document.createElement('style');
  style.id = 'adminCardCollapseStyle';
  style.textContent = `
    .admin-collapse-head {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
    }
    .admin-collapse-head h1,
    .admin-collapse-head h2,
    .admin-collapse-head h3 {
      margin: 0 !important;
    }
    .admin-collapse-btn {
      border: 0;
      cursor: pointer;
      white-space: nowrap;
      padding: 5px 12px;
      border-radius: 999px;
      background: #f3f4f6;
      color: #374151;
      font-size: 12px;
      font-weight: 900;
    }
    .admin-card.admin-card-collapsed > *:not(.admin-collapse-head) {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function cleanTitle(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function cardTitle(card) {
  const h = card.querySelector('h1,h2,h3');
  return cleanTitle(h ? h.textContent : '');
}

function storageKey(title) {
  return STORAGE_PREFIX + encodeURIComponent(title);
}

function shouldDefaultOpen(title) {
  return DEFAULT_OPEN_TITLES.some(t => title.includes(t));
}

function shouldSkipCard(card) {
  return SKIP_CARD_SELECTORS.some(sel => card.matches(sel));
}

function ensureHeader(card, title) {
  let heading = card.querySelector('h1,h2,h3');
  if (!heading) return null;

  let head = heading.parentElement;
  if (!head || head.parentElement !== card) {
    head = heading;
  }
  head.classList.add('admin-collapse-head');

  if (head.querySelector('.admin-collapse-btn')) return head;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-collapse-btn';
  btn.dataset.adminCollapseTitle = title;
  head.appendChild(btn);
  return head;
}

function paint(card, btn, collapsed) {
  card.classList.toggle('admin-card-collapsed', collapsed);
  if (btn) btn.textContent = collapsed ? '展开 ▾' : '收起 ▴';
}

function setupCard(card) {
  if (!card || card.dataset.adminCollapseReady === '1') return;
  if (card.classList.contains('admin-login-status')) return;
  if (shouldSkipCard(card)) return;

  const title = cardTitle(card);
  if (!title) return;
  const head = ensureHeader(card, title);
  if (!head) return;

  const btn = head.querySelector('.admin-collapse-btn');
  const key = storageKey(title);
  const saved = localStorage.getItem(key);
  const collapsed = saved === null ? !shouldDefaultOpen(title) : saved === '1';

  paint(card, btn, collapsed);
  card.dataset.adminCollapseReady = '1';

  if (btn) {
    btn.addEventListener('click', function () {
      const next = !card.classList.contains('admin-card-collapsed');
      localStorage.setItem(key, next ? '1' : '0');
      paint(card, btn, next);
    });
  }
}

function setupAllCards() {
  document.querySelectorAll('.admin-box > .admin-card').forEach(setupCard);
}

export function initAdminCardCollapse() {
  if (document.body.dataset.page !== 'admin') return;
  injectStyle();
  setupAllCards();

  const box = document.querySelector('.admin-box');
  if (!box || box.dataset.adminCollapseObserver === '1') return;
  box.dataset.adminCollapseObserver = '1';

  const observer = new MutationObserver(function () {
    setupAllCards();
  });
  observer.observe(box, { childList: true, subtree: false });
}
