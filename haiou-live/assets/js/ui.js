/**
 * 海鸥直播 V4.2 — 公共 UI 模块
 *
 * 职责：头部导航、底部导航、手机标签栏、公共卡片组件、浮动广告
 */

import { state, base, page, currentTab, href, asset, esc, getHost } from './config.js';

// ===================== 导航项配置 =====================

export function navItems() {
  return [
    { key: 'home', text: '首页', url: 'index.html' },
    { key: 'live', text: '全部直播', url: 'pages/live.html' },
    { key: 'replays', text: '赛事回放', url: 'pages/replays.html' },
    { key: 'app', text: '下载APP', url: 'pages/app.html', hot: true }
  ];
}

export function mobileTabs() {
  const isLivePage = ['home', 'live'].includes(page);
  const active = page === 'replays' ? 'replays'
    : page === 'schedule' ? 'schedule'
    : currentTab === 'football' ? 'football'
    : currentTab === 'basketball' ? 'basketball'
    : currentTab === 'analysis' ? 'analysis'
    : 'recommend';

  const tabs = isLivePage ? [
    { key: 'recommend', text: '推荐', url: page === 'home' ? 'index.html' : 'pages/live.html' },
    { key: 'football', text: '足球', url: 'pages/live.html?tab=football' },
    { key: 'basketball', text: '篮球', url: 'pages/live.html?tab=basketball' },
    { key: 'analysis', text: '分析', url: 'pages/live.html?tab=analysis' }
  ] : page === 'follow' ? [
    { key: 'follow', text: '关注', url: 'pages/follow.html' },
    { key: 'reserve', text: '预约', url: 'pages/schedule.html' }
  ] : [
    { key: 'recommend', text: '推荐', url: 'index.html' },
    { key: 'football', text: '足球', url: 'pages/live.html?tab=football' },
    { key: 'basketball', text: '篮球', url: 'pages/live.html?tab=basketball' },
    { key: 'analysis', text: '分析', url: 'pages/live.html?tab=analysis' }
  ];
  return { tabs, active };
}

function renderBrandLogo(cfg, className) {
  const name = cfg.brand.name || '海鸥直播';
  const domain = String(cfg.brand.domain || 'S6.LOL').toUpperCase();
  return `<a class="logo-brand ${className || ''}" href="${href('index.html')}" aria-label="${esc(name)}">
    <span class="logo-mark"><img src="${asset('assets/icons/app-icon.svg')}" alt=""></span>
    <span class="logo-copy"><span class="logo-name">${esc(name)}</span><span class="logo-domain">${esc(domain)}</span></span>
  </a>`;
}

function bindHeaderScrollState(header) {
  if (!header) return;

  const update = () => {
    const useHeroHeader = page === 'home' && window.scrollY < 56;
    header.classList.toggle('is-hero', useHeroHeader);
  };

  update();
  if (header.dataset.scrollBound === '1') return;
  header.dataset.scrollBound = '1';
  window.addEventListener('scroll', update, { passive: true });
}

// ===================== 通用弹窗 =====================

function showModal(title, bodyHtml, btnText) {
  var existing = document.querySelector('#globalModal');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'globalModal';
  overlay.className = 'global-modal-overlay';
  overlay.innerHTML = '<div class="global-modal-box"><h2>' + esc(title) + '</h2><div class="global-modal-body">' + bodyHtml + '</div><button class="global-modal-btn" id="globalModalClose">' + (btnText || '我知道了') + '</button></div>';
  document.body.appendChild(overlay);
  var close = function () { overlay.remove(); };
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  overlay.querySelector('#globalModalClose').addEventListener('click', close);
}

function showAddToHomeModal() {
  showModal('添加到主屏幕',
    '<ol style="padding-left:18px;line-height:2;font-size:14px;color:#333;"><li>点击 Safari 底部的 <b>分享按钮</b></li><li>向下滑动，选择 <b>「添加到主屏幕」</b></li><li>点击右上角 <b>「添加」</b></li></ol>',
    '我知道了');
}

function showDownloadAppModal() {
  showModal('下载海鸥直播 APP',
    '<p style="color:#555;line-height:1.6;">APP 正在准备中，当前可先<span style="color:#ff6a00;font-weight:700;">添加到主屏幕</span>使用。</p>',
    '添加到主屏幕教程');
  // 绑定自定义按钮文案对应动作
  setTimeout(function () {
    var btn = document.querySelector('#globalModalClose');
    if (btn) {
      btn.textContent = '添加到主屏幕教程';
      btn.addEventListener('click', function () {
        document.querySelector('#globalModal')?.remove();
        showAddToHomeModal();
      }, { once: true });
    }
  }, 50);
}

// ===================== 全局外壳渲染 =====================

export function renderGlobalChrome() {
  if (['app', 'login'].includes(page)) return;
  const cfg = state.cfg;

  // PC 顶部导航
  const header = document.querySelector('#siteHeader');
  if (header) {
    const activeKey = page === 'home' ? 'home' : page === 'room' ? 'live' : page;
    const userToken = localStorage.getItem('token');
    let userName = '我的';
    try {
      const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
      if (profile && profile.nickname) userName = profile.nickname;
    } catch (e) {}
    const loginHtml = userToken
      ? `<div class="pc-login"><span class="icon-dot"></span><a href="${href('pages/user.html')}">${esc(userName || '我的')}</a></div>`
      : `<div class="pc-login"><span class="icon-dot"></span><a href="${href('pages/login.html')}">登录</a><span>|</span><a href="${href('pages/login.html?register=1')}">注册</a></div>`;
    header.innerHTML = `<div class="container">
      ${renderBrandLogo(cfg, 'logo-link pc-logo-brand')}
      <nav class="pc-nav">${navItems().map(n => `<a class="${activeKey === n.key ? 'is-active' : ''} ${n.hot ? 'hot' : ''}" href="${href(n.url)}">${n.text}</a>`).join('')}</nav>
      ${loginHtml}
    </div>`;
    bindHeaderScrollState(header);
  }

  // 手机顶部 — 只保留 logo + 添加到主屏幕
  const mHeader = document.querySelector('#mobileHeader');
  if (mHeader) {
    mHeader.innerHTML = `${renderBrandLogo(cfg, 'mobile-logo-brand')}<span class="spacer"></span><a class="mini-btn" href="javascript:void(0)" id="btnAddToHome">添加到主屏幕</a>`;
    // 绑定事件
    setTimeout(function () {
      var addBtn = document.querySelector('#btnAddToHome');
      if (addBtn) {
        addBtn.addEventListener('click', function (e) {
          e.preventDefault();
          showAddToHomeModal();
        });
      }
    }, 0);
  }

  // 手机标签栏
  const mTabs = document.querySelector('#mobileTabs');
  if (mTabs && !['user', 'room', 'replays'].includes(page)) {
    const { tabs, active } = mobileTabs();
    mTabs.innerHTML = tabs.map(t => `<a class="${active === t.key ? 'is-active' : ''}" href="${href(t.url)}">${t.text}</a>`).join('');
  } else if (mTabs) mTabs.remove();

  if (!['login', 'app', 'admin'].includes(page)) renderBottomNav();

  // 右侧悬浮工具栏（PC 端固定显示）
  if (!['login', 'app', 'admin'].includes(page)) {
    const existing = document.querySelector('#sideToolbar');
    if (existing) existing.remove();
    const toolbar = document.createElement('div');
    toolbar.id = 'sideToolbar';
    toolbar.className = 'side-toolbar pc-only';
    toolbar.innerHTML = `<button id="btnBackTop" title="返回顶部">▲<br>顶部</button><a href="${href('pages/app.html')}" title="下载APP">▼<br>APP</a><button id="btnFeedback" title="意见反馈">✉<br>反馈</button>`;
    document.body.appendChild(toolbar);
    // 返回顶部
    toolbar.querySelector('#btnBackTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    // 意见反馈
    toolbar.querySelector('#btnFeedback').addEventListener('click', () => alert('反馈功能暂未开放'));
  }
}

// ===================== 底部导航 =====================

export function renderBottomNav() {
  const existing = document.querySelector('#mBottomNav');
  if (existing) existing.remove();
  const active = page === 'home' ? 'home' : page === 'replays' ? 'replays' : page === 'user' ? 'user' : 'live';
  const nav = document.createElement('nav');
  nav.id = 'mBottomNav';
  nav.className = 'm-bottom-nav';
  nav.innerHTML = [
    ['home', '首页', 'index.html'],
    ['live', '直播', 'pages/live.html'],
    ['replays', '回放', 'pages/replays.html'],
    ['user', '我的', 'pages/user.html']
  ].map(([k, t, u]) => `<a class="${active === k ? 'is-active' : ''}" href="${href(u)}"><span class="nav-ico"></span><span>${t}</span></a>`).join('');
  document.body.appendChild(nav);
}

// ===================== 公共卡片组件 =====================

export function liveCard(room) {
  const host = getHost(room.hostId);
  const anchorName = room.anchorName || host.name || '主播';
  return `<a class="live-card" href="${href(`pages/room.html?id=${room.id}`)}">
    <div class="live-cover"><img src="${asset(room.cover)}" alt="${esc(room.title)}"><span class="live-badge">▥ Live</span><span class="quality-badge">${esc(room.quality || '高清')}</span></div>
    <div class="live-info"><div class="live-title">${esc(room.title)}</div><div class="live-meta"><span class="live-host"><img src="${asset(host.avatar)}" alt="">${esc(anchorName)}</span><span>♨ ${esc(room.viewers || '0')}</span></div></div>
  </a>`;
}

export function horizontalMatchCard(m) {
  const rid = m.boundRoomId || m.roomId || '';
  return `<div class="horizontal-card"><div class="row1"><span>☯ ${esc(m.league)}</span><span>${esc(m.day)}&nbsp;&nbsp;${esc(m.time)}</span></div>
    <div class="team"><img src="${asset(m.homeLogo)}" alt="">${esc(m.home)}</div>
    <div class="team"><img src="${asset(m.awayLogo)}" alt="">${esc(m.away)}</div>
    <a class="reserve-btn" href="${href(`pages/room.html?id=${rid}`)}">${m.status === '直播中' ? '进入' : '预约'}</a></div>`;
}

// ===================== 手机浮动广告 =====================

export function mobileFloatAd() {
  const mf = state.cfg.ads.mobileFloat || '';
  const text = typeof mf === 'object' ? (mf.text || '') : mf;
  return `<div class="m-float-ad" id="mobileFloatBar"><span class="close" id="btnCloseFloat">×</span><img src="${asset(state.cfg.brand.logo)}" alt=""><span class="text">${esc(text)}</span><a class="download" href="javascript:void(0)" id="btnDownloadFloat">下载APP</a></div>`;
}

/** 为浮动广告绑定关闭和下载弹窗事件 */
export function bindFloatBarEvents() {
  var closeBtn = document.querySelector('#btnCloseFloat');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      var bar = document.querySelector('#mobileFloatBar');
      if (bar) bar.style.display = 'none';
    });
  }
  var downloadBtn = document.querySelector('#btnDownloadFloat');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function (e) {
      e.preventDefault();
      showDownloadAppModal();
    });
  }
}

// ===================== 页脚 =====================

export function renderFooter() {
  if (['app', 'login', 'user', 'follow'].includes(page)) return;
  const footer = document.createElement('footer');
  footer.className = 'footer pc-only';
  footer.innerHTML = `<div><img src="${asset(state.cfg.brand.logo)}" alt=""><div><a href="#">新手主播教程</a><a href="#">直播常见问题</a><a href="#">用户协议说明</a></div></div>`;
  document.body.appendChild(footer);
}
