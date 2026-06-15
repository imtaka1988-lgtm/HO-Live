function cleanTitle(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function cardTitle(card) {
  const h = card && card.querySelector('h1,h2,h3');
  return cleanTitle(h ? h.textContent : '');
}

function findAdminCardByTitle(part) {
  return Array.from(document.querySelectorAll('.admin-box > .admin-card')).find(function (card) {
    return cardTitle(card).includes(part);
  });
}

function ensureMiniApiHolder(loginCard) {
  let holder = loginCard.querySelector('#adminApiMiniStatus');
  if (holder) return holder;

  loginCard.style.position = 'relative';
  holder = document.createElement('div');
  holder.id = 'adminApiMiniStatus';
  holder.style.cssText = 'position:absolute;right:18px;top:18px;font-size:12px;font-weight:800;color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:999px;padding:6px 12px;';
  holder.textContent = 'API 检测中...';
  loginCard.appendChild(holder);
  return holder;
}

function moveApiStatusToTop() {
  const loginCard = document.querySelector('.admin-login-status');
  const apiCard = findAdminCardByTitle('API 接口状态');
  if (!loginCard || !apiCard) return;

  const status = apiCard.querySelector('#apiStatus');
  const holder = ensureMiniApiHolder(loginCard);
  if (status && !holder.contains(status)) {
    status.style.margin = '0';
    status.style.fontSize = '12px';
    status.style.color = '#16a34a';
    holder.innerHTML = '';
    holder.appendChild(status);
  }
  apiCard.style.display = 'none';
}

function hideThemeCard() {
  const themeCard = findAdminCardByTitle('全站主题颜色');
  if (themeCard) themeCard.style.display = 'none';
}

function cleanup() {
  if (document.body.dataset.page !== 'admin') return;
  hideThemeCard();
  moveApiStatusToTop();
}

export function initAdminDashboardCleanup() {
  if (document.body.dataset.page !== 'admin') return;
  let attempts = 0;
  const tick = function () {
    cleanup();
    attempts += 1;
    if (attempts < 30) setTimeout(tick, 120);
  };
  tick();
}
