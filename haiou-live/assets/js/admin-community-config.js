/**
 * 后台交流群配置卡片
 */

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

const DEFAULT_CONFIG = {
  app: { enabled: true, tag: '主推', title: '海鸥聊天 App', desc: '', qrImage: '', customerId: '', groupId: '', buttonText: '', buttonLink: '' },
  wechat: { enabled: true, tag: '微信', title: '微信群 / 微信客服', desc: '', serviceQrImage: '', groupQrImage: '', serviceId: '', groupId: '' },
  official: { enabled: true, tag: '公众号', title: '微信公众号', desc: '', qrImage: '', accountName: '', pushText: '' }
};

function mergeConfig(config) {
  const c = config || {};
  return {
    app: { ...DEFAULT_CONFIG.app, ...(c.app || {}) },
    wechat: { ...DEFAULT_CONFIG.wechat, ...(c.wechat || {}) },
    official: { ...DEFAULT_CONFIG.official, ...(c.official || {}) }
  };
}

function field(id, label, value, placeholder) {
  return `<label style="display:block;font-size:12px;font-weight:900;color:#555;">${esc(label)}
    <input id="${id}" value="${esc(value || '')}" placeholder="${esc(placeholder || '')}" style="width:100%;height:34px;margin-top:5px;padding:0 10px;border:1px solid #ddd;border-radius:8px;">
  </label>`;
}

function textArea(id, label, value, placeholder) {
  return `<label style="display:block;font-size:12px;font-weight:900;color:#555;">${esc(label)}
    <textarea id="${id}" placeholder="${esc(placeholder || '')}" style="width:100%;min-height:70px;margin-top:5px;padding:9px 10px;border:1px solid #ddd;border-radius:8px;line-height:1.55;resize:vertical;">${esc(value || '')}</textarea>
  </label>`;
}

function enabled(id, checked) {
  return `<label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#555;">
    <input id="${id}" type="checkbox" ${checked ? 'checked' : ''}> 启用这个板块
  </label>`;
}

function sectionHtml(key, title, body) {
  return `<div style="padding:14px;border-radius:14px;background:#f8fafc;border:1px solid #eef2f7;">
    <h3 style="margin:0 0 12px;font-size:15px;color:#111827;">${esc(title)}</h3>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">${body}</div>
  </div>`;
}

function cardHtml(config) {
  const c = mergeConfig(config);
  return `<div class="admin-card" id="adminCommunityConfigCard">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
      <h2 style="margin:0;">交流群配置</h2>
      <span style="font-size:12px;color:#999;font-weight:700;">保存后下一步接到用户端页面</span>
    </div>
    <p style="color:#999;margin:0 0 14px;font-size:13px;">先填写图片地址和 ID，后续再加“后台上传图片”按钮。</p>
    <div style="display:grid;gap:12px;">
      ${sectionHtml('app', '① 海鸥聊天 App', `
        ${enabled('ccAppEnabled', c.app.enabled)}
        ${field('ccAppTag', '角标', c.app.tag, '主推')}
        ${field('ccAppTitle', '标题', c.app.title, '海鸥聊天 App')}
        ${field('ccAppQrImage', '二维码 / 图片地址', c.app.qrImage, '例如 /uploads/community/app.png')}
        ${field('ccAppCustomerId', '客服 ID', c.app.customerId, '例如 HAI2026')}
        ${field('ccAppGroupId', '群组 ID', c.app.groupId, '例如 888888')}
        ${field('ccAppButtonText', '按钮文字', c.app.buttonText, '立即进入')}
        ${field('ccAppButtonLink', '入口链接', c.app.buttonLink, 'https://...')}
        <div style="grid-column:1 / -1;">${textArea('ccAppDesc', '说明文字', c.app.desc, '填写 App 入口说明')}</div>
      `)}
      ${sectionHtml('wechat', '② 微信客服 / 微信群', `
        ${enabled('ccWechatEnabled', c.wechat.enabled)}
        ${field('ccWechatTag', '角标', c.wechat.tag, '微信')}
        ${field('ccWechatTitle', '标题', c.wechat.title, '微信群 / 微信客服')}
        ${field('ccWechatServiceQrImage', '微信客服二维码地址', c.wechat.serviceQrImage, '/uploads/community/wechat-service.png')}
        ${field('ccWechatGroupQrImage', '微信群二维码地址', c.wechat.groupQrImage, '/uploads/community/wechat-group.png')}
        ${field('ccWechatServiceId', '微信客服 ID', c.wechat.serviceId, '例如 haiou2026')}
        ${field('ccWechatGroupId', '微信群说明 / ID', c.wechat.groupId, '二维码入群')}
        <div></div>
        <div style="grid-column:1 / -1;">${textArea('ccWechatDesc', '说明文字', c.wechat.desc, '填写微信入口说明')}</div>
      `)}
      ${sectionHtml('official', '③ 微信公众号', `
        ${enabled('ccOfficialEnabled', c.official.enabled)}
        ${field('ccOfficialTag', '角标', c.official.tag, '公众号')}
        ${field('ccOfficialTitle', '标题', c.official.title, '微信公众号')}
        ${field('ccOfficialQrImage', '公众号二维码地址', c.official.qrImage, '/uploads/community/official.png')}
        ${field('ccOfficialAccountName', '公众号名称', c.official.accountName, '顶红体育 / 海鸥直播')}
        ${field('ccOfficialPushText', '推送内容', c.official.pushText, '直播提醒 / 赛事分析 / 回放更新')}
        <div style="grid-column:1 / -1;">${textArea('ccOfficialDesc', '说明文字', c.official.desc, '填写公众号说明')}</div>
      `)}
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:14px;">
      <button id="btnSaveCommunityConfig" type="button" style="padding:8px 18px;background:#ff8a00;color:#fff;border-radius:999px;font-size:13px;font-weight:900;">保存交流群配置</button>
      <button id="btnReloadCommunityConfig" type="button" style="padding:8px 14px;background:#e5e7eb;color:#111827;border-radius:999px;font-size:13px;font-weight:900;">重新加载</button>
      <span id="communityConfigStatus" style="font-size:12px;color:#999;"></span>
    </div>
  </div>`;
}

function val(id) {
  return (document.querySelector('#' + id)?.value || '').trim();
}

function checked(id) {
  return !!document.querySelector('#' + id)?.checked;
}

function readFormConfig() {
  return {
    app: {
      enabled: checked('ccAppEnabled'),
      tag: val('ccAppTag'),
      title: val('ccAppTitle'),
      desc: val('ccAppDesc'),
      qrImage: val('ccAppQrImage'),
      customerId: val('ccAppCustomerId'),
      groupId: val('ccAppGroupId'),
      buttonText: val('ccAppButtonText'),
      buttonLink: val('ccAppButtonLink')
    },
    wechat: {
      enabled: checked('ccWechatEnabled'),
      tag: val('ccWechatTag'),
      title: val('ccWechatTitle'),
      desc: val('ccWechatDesc'),
      serviceQrImage: val('ccWechatServiceQrImage'),
      groupQrImage: val('ccWechatGroupQrImage'),
      serviceId: val('ccWechatServiceId'),
      groupId: val('ccWechatGroupId')
    },
    official: {
      enabled: checked('ccOfficialEnabled'),
      tag: val('ccOfficialTag'),
      title: val('ccOfficialTitle'),
      desc: val('ccOfficialDesc'),
      qrImage: val('ccOfficialQrImage'),
      accountName: val('ccOfficialAccountName'),
      pushText: val('ccOfficialPushText')
    }
  };
}

async function fetchConfig(token) {
  const res = await fetch('/api/admin/community-config', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return res.json();
}

async function saveConfig(token, config) {
  const res = await fetch('/api/admin/community-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ config })
  });
  return res.json();
}

function bindCard(token) {
  const saveBtn = document.querySelector('#btnSaveCommunityConfig');
  const reloadBtn = document.querySelector('#btnReloadCommunityConfig');
  const status = document.querySelector('#communityConfigStatus');

  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      if (status) status.textContent = '保存中...';
      const result = await saveConfig(token, readFormConfig());
      if (!result || !result.ok) {
        if (status) status.textContent = '保存失败：' + ((result && result.error) ? result.error : '未知错误');
        return;
      }
      if (status) status.textContent = '已保存，下一步会同步到用户端页面';
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener('click', function () {
      loadCard(token, true);
    });
  }
}

async function loadCard(token, replace) {
  const old = document.querySelector('#adminCommunityConfigCard');
  const status = document.querySelector('#communityConfigStatus');
  try {
    const data = await fetchConfig(token);
    if (!data || !data.ok) throw new Error(data && data.error ? data.error : 'load failed');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = cardHtml(data.config || DEFAULT_CONFIG);
    const card = wrapper.firstElementChild;

    if (old && replace) {
      old.replaceWith(card);
    } else if (!old) {
      const box = document.querySelector('.admin-box');
      if (!box) return;
      const siteMessageCard = document.querySelector('#adminSiteMessageCard');
      if (siteMessageCard && siteMessageCard.nextSibling) {
        box.insertBefore(card, siteMessageCard.nextSibling);
      } else if (siteMessageCard) {
        box.appendChild(card);
      } else {
        box.appendChild(card);
      }
    }
    bindCard(token);
  } catch (e) {
    if (status) status.textContent = '加载失败';
  }
}

export function initAdminCommunityConfig() {
  if (document.body.dataset.page !== 'admin') return;
  const token = localStorage.getItem('admin_token');
  if (!token) return;
  if (document.querySelector('#adminCommunityConfigCard')) return;
  loadCard(token, false);
}
