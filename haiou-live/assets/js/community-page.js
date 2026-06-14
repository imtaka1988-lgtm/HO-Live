/**
 * 私域交流群入口页
 * 当前为雏形，后续只需要替换客服 ID、二维码和软件入口。
 */

import { state, asset, esc } from './config.js';

function qrBox(label) {
  return `<div class="community-qr-box"><span>${esc(label)}</span></div>`;
}

export function renderCommunityPage() {
  const brand = state.cfg.brand || {};
  const logo = brand.logo || 'assets/img/logo.svg';

  return `<main class="community-page">
    <div class="container">
      <section class="community-hero">
        <div>
          <span class="community-kicker">海鸥直播私域</span>
          <h1>加入赛事交流群</h1>
          <p>下载私域聊天软件、添加客服或关注公众号，获取直播提醒、赛事分析、经典回放更新和群内交流。</p>
        </div>
        <img src="${asset(logo)}" alt="${esc(brand.name || '海鸥直播')}">
      </section>

      <section class="community-grid">
        <article class="community-card is-primary">
          <div class="community-card-head">
            <span>主推</span>
            <h2>海鸥聊天 App</h2>
          </div>
          <p>当前主推的私域聊天入口，后续也可以替换成其他聊天软件或群组平台。</p>
          ${qrBox('App 下载码待配置')}
          <div class="community-info-row"><b>客服 ID</b><span>待配置</span></div>
          <div class="community-info-row"><b>群组 ID</b><span>待配置</span></div>
          <button type="button" class="community-btn">入口待配置</button>
        </article>

        <article class="community-card">
          <div class="community-card-head">
            <span>微信</span>
            <h2>微信群 / 微信客服</h2>
          </div>
          <p>添加微信客服后备注“海鸥直播”，管理员会邀请进入对应赛事交流群。</p>
          <div class="community-two-qr">
            ${qrBox('微信客服二维码')}
            ${qrBox('微信群二维码')}
          </div>
          <div class="community-info-row"><b>微信客服</b><span>待配置</span></div>
          <div class="community-info-row"><b>微信群</b><span>二维码待配置</span></div>
        </article>

        <article class="community-card">
          <div class="community-card-head">
            <span>公众号</span>
            <h2>微信公众号</h2>
          </div>
          <p>关注公众号，接收直播入口、赛前提醒、赛事分析和回放更新。</p>
          ${qrBox('公众号二维码待配置')}
          <div class="community-info-row"><b>公众号名称</b><span>待配置</span></div>
          <div class="community-info-row"><b>推送内容</b><span>直播提醒 / 赛事分析 / 回放更新</span></div>
        </article>
      </section>

      <section class="community-note">
        <b>后续只需要替换：</b>软件入口、客服 ID、微信群二维码、公众号二维码。页面结构可以保持不动。
      </section>
    </div>
  </main>`;
}
