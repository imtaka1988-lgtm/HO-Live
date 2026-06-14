/**
 * 私域交流群入口页
 * 从后台读取 App / 微信 / 公众号三个板块配置。
 */

import { state, asset, href, esc } from './config.js';

const DEFAULT_CONFIG = {
  app: {
    enabled: true,
    tag: '主推',
    title: '海鸥球迷交流 App',
    desc: '下载海鸥球迷交流 App，获取直播提醒、赛事回放更新和球迷讨论入口。',
    qrImage: '/assets/icons/app-icon.svg',
    customerId: 'HAIOU2026',
    groupId: 'HAIOU-888888',
    buttonText: '立即进入交流区',
    buttonLink: '/pages/app.html'
  },
  wechat: {
    enabled: true,
    tag: '微信',
    title: '海鸥微信客服 / 赛事群',
    desc: '添加微信客服后备注“海鸥直播”，管理员会邀请进入对应赛事交流群。',
    serviceQrImage: '/assets/img/avatar-default.svg',
    groupQrImage: '/assets/img/thumb-1.svg',
    serviceId: 'haiou2026',
    groupId: '海鸥赛事交流群 01'
  },
  official: {
    enabled: true,
    tag: '公众号',
    title: '海鸥直播情报站',
    desc: '关注公众号，接收直播入口、赛前提醒、赛事分析和经典回放更新。',
    qrImage: '/assets/img/thumb-2.svg',
    accountName: '海鸥直播助手',
    pushText: '直播提醒 / 赛事分析 / 回放更新'
  }
};

function mergeConfig(config) {
  const c = config || {};
  return {
    app: { ...DEFAULT_CONFIG.app, ...(c.app || {}) },
    wechat: { ...DEFAULT_CONFIG.wechat, ...(c.wechat || {}) },
    official: { ...DEFAULT_CONFIG.official, ...(c.official || {}) }
  };
}

function qrBox(label, src) {
  if (src) {
    return `<div class="community-qr-box"><img src="${asset(src)}" alt="${esc(label)}" style="width:100%;height:100%;object-fit:contain;padding:10px;"></div>`;
  }
  return `<div class="community-qr-box"><span>${esc(label)}</span></div>`;
}

function appButton(cfg) {
  const text = cfg.buttonText || '入口待配置';
  if (cfg.buttonLink) {
    return `<a href="${href(cfg.buttonLink)}" class="community-btn" target="${cfg.buttonLink.startsWith('http') ? '_blank' : '_self'}" rel="noopener">${esc(text)}</a>`;
  }
  return `<button type="button" class="community-btn">${esc(text)}</button>`;
}

function renderCommunityCards(rawConfig) {
  const cfg = mergeConfig(rawConfig);
  const cards = [];

  if (cfg.app.enabled) {
    cards.push(`<article class="community-card is-primary">
      <div class="community-card-head">
        <span>${esc(cfg.app.tag || '主推')}</span>
        <h2>${esc(cfg.app.title || '海鸥聊天 App')}</h2>
      </div>
      <p>${esc(cfg.app.desc || '')}</p>
      ${qrBox('App 下载码', cfg.app.qrImage)}
      <div class="community-info-row"><b>客服 ID</b><span>${esc(cfg.app.customerId || '待配置')}</span></div>
      <div class="community-info-row"><b>群组 ID</b><span>${esc(cfg.app.groupId || '待配置')}</span></div>
      ${appButton(cfg.app)}
    </article>`);
  }

  if (cfg.wechat.enabled) {
    cards.push(`<article class="community-card">
      <div class="community-card-head">
        <span>${esc(cfg.wechat.tag || '微信')}</span>
        <h2>${esc(cfg.wechat.title || '微信群 / 微信客服')}</h2>
      </div>
      <p>${esc(cfg.wechat.desc || '')}</p>
      <div class="community-two-qr">
        ${qrBox('微信客服二维码', cfg.wechat.serviceQrImage)}
        ${qrBox('微信群二维码', cfg.wechat.groupQrImage)}
      </div>
      <div class="community-info-row"><b>微信客服</b><span>${esc(cfg.wechat.serviceId || '待配置')}</span></div>
      <div class="community-info-row"><b>微信群</b><span>${esc(cfg.wechat.groupId || '二维码待配置')}</span></div>
    </article>`);
  }

  if (cfg.official.enabled) {
    cards.push(`<article class="community-card">
      <div class="community-card-head">
        <span>${esc(cfg.official.tag || '公众号')}</span>
        <h2>${esc(cfg.official.title || '微信公众号')}</h2>
      </div>
      <p>${esc(cfg.official.desc || '')}</p>
      ${qrBox('公众号二维码', cfg.official.qrImage)}
      <div class="community-info-row"><b>公众号名称</b><span>${esc(cfg.official.accountName || '待配置')}</span></div>
      <div class="community-info-row"><b>推送内容</b><span>${esc(cfg.official.pushText || '直播提醒 / 赛事分析 / 回放更新')}</span></div>
    </article>`);
  }

  if (!cards.length) {
    return `<article class="community-card"><h2>交流群入口暂未开放</h2><p>管理员正在配置私域交流群入口，请稍后再来。</p></article>`;
  }

  return cards.join('');
}

async function loadCommunityConfig() {
  const grid = document.querySelector('#communityGrid');
  const note = document.querySelector('#communityConfigNote');
  if (!grid) return;

  try {
    const res = await fetch('/api/public/community-config');
    const data = await res.json();
    if (!data || !data.ok) throw new Error('load failed');
    grid.innerHTML = renderCommunityCards(data.config || DEFAULT_CONFIG);
    if (note) note.innerHTML = '<b>配置来源：</b>后台“交流群配置”模块。';
  } catch (e) {
    grid.innerHTML = renderCommunityCards(DEFAULT_CONFIG);
    if (note) note.innerHTML = '<b>提示：</b>后台配置暂时读取失败，当前显示默认占位内容。';
  }
}

export function renderCommunityPage() {
  const brand = state.cfg.brand || {};
  const logo = 'assets/icons/app-icon.svg';
  setTimeout(loadCommunityConfig, 0);

  return `<main class="community-page">
    <div class="container">
      <section class="community-hero">
        <div>
          <span class="community-kicker">海鸥直播私域</span>
          <h1>加入赛事交流群</h1>
          <p>下载私域聊天软件、添加客服或关注公众号，获取直播提醒、赛事分析、经典回放更新和群内交流。</p>
        </div>
        <img class="community-hero-logo" src="${asset(logo)}" alt="${esc(brand.name || '海鸥直播')}">
      </section>

      <section class="community-grid" id="communityGrid">
        ${renderCommunityCards(DEFAULT_CONFIG)}
      </section>

      <section class="community-note" id="communityConfigNote">
        <b>配置来源：</b>正在读取后台交流群配置...
      </section>
    </div>
  </main>`;
}
