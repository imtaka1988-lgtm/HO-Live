/**
 * 海鸥直播 V4.2 — APP 下载页 & 登录页 & 管理后台
 */

import { state, href, asset, esc, safeJson } from './config.js';
import { renderLogin } from './auth.js';
import { adminLogin, adminGetMe, adminGetRooms, adminUpdateRoom, adminUpdateStream, adminCreateStream, adminDeleteStream, adminCreateRoom, adminDeleteRoom } from './api.js';

// ===================== APP 下载页 =====================

export function renderAppPage() {
  const cfg = state.cfg;
  return `<main class="app-page"><a class="back-home-btn" href="${href('index.html')}">← 返回首页</a><section class="app-card"><img class="app-logo" src="${asset(cfg.brand.logo)}" alt="${esc(cfg.brand.name)}"><div class="app-tabs"><a href="${cfg.links.androidApk}">安卓APP</a><a href="${cfg.links.iosApp}">苹果APP</a></div><div><a style="color:#0000ee;text-decoration:underline;font-weight:700;" href="${cfg.links.androidApk}">点击安卓APP安装包</a></div><h3 style="margin-top:34px;">备用网址</h3><div class="app-links">${(cfg.links.backupDomains || []).map(d => `<a href="#">${esc(d)}</a>`).join('')}</div><div class="app-footer"><div>应用名称：${esc(cfg.brand.appName)} | 应用版本：${esc(cfg.brand.version)}</div><div>开发者：${esc(cfg.brand.name)} 体育文化有限公司</div><div>更改时间：2026.06.12 | <a href="#" style="color:#00e;text-decoration:underline;">权限详情</a> | <a href="#" style="color:#00e;text-decoration:underline;">隐私协议</a></div></div></section></main>`;
}

export { renderLogin };

// ===================== 管理后台 =====================

export function renderAdmin() {
  const token = localStorage.getItem('admin_token');
  if (token) {
    return `<main class="page-shell"><div class="admin-box">
      <div class="admin-card admin-login-status">
        <h1>管理后台已登录</h1>
        <p id="adminUsername" style="font-size:18px;color:#666;">加载中...</p>
        <div class="admin-actions" style="margin-top:16px;">
          <button id="btnAdminLogout">退出登录</button>
        </div>
      </div>
      <div class="admin-card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
          <h2 style="margin:0;">房间列表</h2>
          <button id="btnAddRoom" type="button" style="padding:6px 14px;background:#3b82f6;color:#fff;border-radius:4px;font-size:13px;">新增房间</button>
        </div>
        <p style="color:#999;margin-bottom:16px;">共 <b id="roomCount">--</b> 个房间</p>
        <div id="roomTableContainer" style="overflow-x:auto;">
          <table class="admin-room-table" style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;text-align:left;">ID</th>
              <th style="padding:8px 12px;text-align:left;">标题</th>
              <th style="padding:8px 12px;text-align:left;">分类</th>
              <th style="padding:8px 12px;text-align:left;">状态</th>
              <th style="padding:8px 12px;text-align:left;">主播</th>
              <th style="padding:8px 12px;text-align:left;">播放源</th>
              <th style="padding:8px 12px;text-align:left;">操作</th>
            </tr></thead>
            <tbody id="roomTableBody"><tr><td colspan="7" style="padding:16px;text-align:center;color:#999;">加载中...</td></tr></tbody>
          </table>
        </div>
        <div id="roomEditor" style="display:none;margin-top:16px;border-top:2px solid var(--brand-yellow);padding-top:16px;"></div>
        <div id="streamEditor" style="display:none;margin-top:16px;border-top:2px solid var(--brand-yellow);padding-top:16px;"></div>
      </div>
      <div class="admin-card">
        <h2>全站主题颜色（高级）</h2>
        <p style="color:#999;margin-bottom:12px;">这里控制全站颜色、背景、圆角等视觉效果。普通维护人员不建议频繁修改。</p>
        <button id="btnToggleTheme" style="padding:6px 16px;font-size:12px;background:#e5e7eb;color:#333;border-radius:4px;">展开全站主题颜色设置 ▸</button>
        <div id="themeConfigPanel" style="display:none;margin-top:14px;padding-top:14px;border-top:1px dashed #ddd;">
          <div class="admin-grid">${renderCssVarFields()}</div>
          <div class="admin-actions" style="margin-top:18px;">
            <button id="saveTheme">保存当前主题预览</button>
            <button id="resetTheme" type="button">恢复默认主题</button>
          </div>
        </div>
      </div>
      <div class="admin-card">
        <h2>API 接口状态</h2>
        <p id="apiStatus" style="color:#999;">检测中...</p>
      </div>
    </div></main>`;
  }
  return `<main class="page-shell"><div class="admin-box"><div class="admin-card" style="text-align:center;padding:40px;">
    <h1>管理员登录</h1>
    <div class="form-line"><input id="adminUser" placeholder="用户名" value="admin"></div>
    <div class="form-line"><input id="adminPass" type="password" placeholder="密码"></div>
    <div class="admin-actions" style="margin-top:20px;"><button id="btnAdminLogin">登录</button></div>
    <p id="adminError" style="color:var(--danger);margin-top:10px;min-height:20px;"></p>
  </div></div></main>`;
}

const CSS_VAR_LABELS = {
  '--brand-yellow': '主色/按钮高亮色',
  '--brand-dark': '深色背景',
  '--brand-black': '黑色区域',
  '--page-bg': '页面背景色',
  '--header-bg-pc': 'PC 顶部背景色',
  '--header-bg-mobile': '手机顶部背景色',
  '--mobile-tab-bg': '手机底部导航背景色',
  '--room-bg': '直播间背景色',
  '--live-badge-bg': '直播中标签颜色',
  '--quality-badge-bg': '清晰度标签颜色',
  '--schedule-side-line': '赛程侧边线颜色',
  '--radius-card': '卡片圆角',
};

function renderCssVarFields() {
  const vars = Object.keys(CSS_VAR_LABELS);
  const current = { ...(state.cfg.theme?.cssVars || {}), ...safeJson(localStorage.getItem('themeOverride') || '{}') };
  return vars.map(v => {
    const val = current[v] || getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    return `<div class="admin-field"><label>${CSS_VAR_LABELS[v] || v}（${v}）</label><input data-var="${v}" value="${esc(val)}"></div>`;
  }).join('');
}

function renderRoomTableRows(rooms) {
  if (!rooms || rooms.length === 0) {
    return '<tr><td colspan="7" style="padding:16px;text-align:center;color:#999;">暂无房间</td></tr>';
  }
  return rooms.map(r => {
    const catMap = { football: '足球', basketball: '篮球', analysis: '分析/综合' };
    const stMap = { live: '直播中', offline: '未开播', pending: '待开播' };
    return `<tr style="border-bottom:1px solid #eee;" data-room-id="${r.id}">
      <td style="padding:8px 12px;">${r.id}</td>
      <td style="padding:8px 12px;font-weight:700;">${esc(r.title)}</td>
      <td style="padding:8px 12px;">${catMap[r.category] || r.category}</td>
      <td style="padding:8px 12px;color:${r.status === 'live' ? 'var(--success)' : '#999'};">${stMap[r.status] || r.status}</td>
      <td style="padding:8px 12px;">${esc(r.anchorName || '--')}</td>
      <td style="padding:8px 12px;">${r.streamCount || (r.streams ? r.streams.length : 0)}</td>
      <td style="padding:6px 4px;white-space:nowrap;">
        <button class="btn-room-edit" data-room-id="${r.id}" style="padding:4px 8px;font-size:11px;background:#3b82f6;color:#fff;border-radius:4px;margin-right:4px;">基础信息</button>
        <button class="btn-stream-mgr" data-room-id="${r.id}" style="padding:4px 8px;font-size:11px;background:var(--brand-yellow);color:#fff;border-radius:4px;margin-right:4px;">播放源管理</button>
        <button class="btn-room-delete" data-room-id="${r.id}" data-room-title="${esc(r.title)}" style="padding:4px 8px;font-size:11px;background:#ef4444;color:#fff;border-radius:4px;">删除</button>
      </td>
    </tr>`;
  }).join('');
}


function coverPreviewSrc(url) {
  url = (url || '').trim();
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || /^data:/i.test(url) || url.startsWith('/')) return url;
  return '/' + url.replace(/^\/+/, '');
}

function renderRoomEditor(room) {
  const catOpts = [{v:'football',t:'足球'},{v:'basketball',t:'篮球'},{v:'analysis',t:'分析/综合'}].map(o => `<option value="${o.v}" ${room.category===o.v?'selected':''}>${o.t}</option>`).join('');
  const stOpts = [{v:'live',t:'直播中'},{v:'offline',t:'未开播'},{v:'pending',t:'待开播'}].map(o => `<option value="${o.v}" ${room.status===o.v?'selected':''}>${o.t}</option>`).join('');

  return `<h3 style="margin:0 0 12px;">房间 #${room.id} 基础信息</h3>
  <div style="display:flex;gap:12px;flex-wrap:wrap;">
    <label style="flex:1;min-width:180px;">房间标题 <input class="re-title" value="${esc(room.title || '')}" style="width:100%;height:32px;padding:0 8px;"></label>
    <label style="width:120px;">房间分类 <select class="re-category" style="width:100%;height:32px;">${catOpts}</select></label>
    <label style="width:110px;">直播状态 <select class="re-status" style="width:100%;height:32px;">${stOpts}</select></label>
    <label style="width:100px;">显示排序 <input class="re-sort" type="number" value="${room.sort || 0}" style="width:100%;height:32px;padding:0 6px;"></label>
  </div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;">
    <label style="flex:1;min-width:220px;">封面图片地址
      <input class="re-cover" value="${esc(room.cover || '')}" style="width:100%;height:32px;padding:0 8px;">
      <div class="admin-cover-preview">
        <img class="re-cover-preview-img" alt="封面预览">
        <span class="re-cover-preview-status">图片预览</span>
      </div>
    </label>
    <label style="flex:1;min-width:140px;">主播名称 <input class="re-anchor" value="${esc(room.anchorName || '')}" style="width:100%;height:32px;padding:0 8px;"></label>
  </div>
  <div style="margin-top:10px;">
    <label style="display:block;">直播间公告 <input class="re-announcement" value="${esc(room.announcement || '')}" style="width:100%;height:32px;padding:0 8px;"></label>
  </div>
  <p style="color:#999;font-size:12px;margin:10px 0 0;">房间标题、主播名称、公告会影响前台展示。封面图片地址请填写图片路径或图片 URL。显示排序数字越小越靠前。</p>
  <button class="btn-room-save" data-room-id="${room.id}" style="margin-top:12px;padding:6px 16px;background:#20c997;color:#fff;border-radius:4px;font-size:13px;">保存房间资料</button>
  <span class="room-save-msg" style="margin-left:10px;font-size:12px;"></span>`;
}

// 翻译对照表
const TYPE_LABELS = { hls: 'HLS/m3u8（网页通用）', flv: 'FLV（低延迟，后续启用）' };
const PROVIDER_LABELS = { tencent: '腾讯云', manual: '手动地址' };
const MODE_LABELS = { room_fixed: '固定房间流', event_session: '按场次流', manual_url: '手动URL' };
const POLICY_LABELS = { auto: '自动', ios: '苹果/iPhone', pc: '电脑', android: '安卓' };

function streamSelect(val, options, labels) {
  return options.map(v => `<option value="${v}" ${v === val ? 'selected' : ''}>${labels[v] || v}</option>`).join('');
}

function renderStreamEditor(room, streams) {
  if (!streams || streams.length === 0) {
    return `<h3 style="margin:0 0 12px;">房间 #${room.id} — ${esc(room.title)} 播放源</h3>
      <div style="margin-bottom:12px;">
        <button class="btn-stream-add" data-type="hls" style="padding:6px 14px;background:#3b82f6;color:#fff;border-radius:4px;font-size:13px;margin-right:8px;">新增 HLS/m3u8</button>
        <button class="btn-stream-add" data-type="flv" style="padding:6px 14px;background:#f97316;color:#fff;border-radius:4px;font-size:13px;">新增 FLV</button>
      </div>
      <p style="color:#999;">该房间暂无播放源，请先新增 HLS 或 FLV。</p>`;
  }
  let html = `<h3 style="margin:0 0 12px;">房间 #${room.id} — ${esc(room.title)} 播放源</h3>`;
  html += `<div style="margin-bottom:12px;">
    <button class="btn-stream-add" data-type="hls" style="padding:6px 14px;background:#3b82f6;color:#fff;border-radius:4px;font-size:13px;margin-right:8px;">新增 HLS/m3u8</button>
    <button class="btn-stream-add" data-type="flv" style="padding:6px 14px;background:#f97316;color:#fff;border-radius:4px;font-size:13px;">新增 FLV</button>
  </div>`;
  html += '<div class="stream-edit-list">';
  streams.forEach(s => {
    const advId = 'stream-adv-' + room.id + '-' + s.id;
    html += `<div class="stream-edit-item" data-stream-id="${s.id}" style="border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin-bottom:10px;background:#fafafa;">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <label style="flex:1;min-width:160px;">线路名称 <input class="se-name" value="${esc(s.name || '')}" style="width:100%;height:30px;padding:0 6px;"></label>
        <label style="width:140px;">播放类型 <select class="se-type" style="width:100%;height:30px;">${streamSelect(s.type, ['hls','flv'], TYPE_LABELS)}</select></label>
        <label style="flex:1;min-width:200px;">播放地址 <input class="se-url" value="${esc(s.url || '')}" style="width:100%;height:30px;padding:0 6px;"></label>
        <label style="display:flex;align-items:center;gap:4px;white-space:nowrap;height:30px;"><input class="se-enabled" type="checkbox" ${s.enabled === 1 ? 'checked' : ''}> 启用</label>
        <label style="display:flex;align-items:center;gap:4px;white-space:nowrap;height:30px;"><input class="se-is-default" type="checkbox" ${s.default === true || s.is_default === 1 ? 'checked' : ''}> 默认播放</label>
      </div>

      <button class="btn-stream-test" type="button" style="margin-top:8px;margin-right:8px;padding:6px 14px;background:#3b82f6;color:#fff;border-radius:4px;font-size:13px;">测试播放</button>
      <button class="btn-stream-save" data-stream-id="${s.id}" style="margin-top:8px;padding:6px 16px;background:#20c997;color:#fff;border-radius:4px;font-size:13px;">保存此播放源</button>
      <button class="btn-stream-delete" data-stream-id="${s.id}" type="button" style="margin-top:8px;margin-left:8px;padding:6px 14px;background:#ef4444;color:#fff;border-radius:4px;font-size:13px;">删除</button>
      <span class="stream-save-msg" style="margin-left:10px;font-size:12px;"></span>
    </div>`;
  });
  html += '</div>';
  return html;
}

function bindThemeToggle() {
  var btn = document.querySelector('#btnToggleTheme');
  var panel = document.querySelector('#themeConfigPanel');
  if (!btn || !panel) return;
  btn.addEventListener('click', function () {
    if (panel.style.display === 'none' || panel.style.display === '') {
      panel.style.display = 'block';
      btn.textContent = '收起全站主题颜色设置 ▾';
    } else {
      panel.style.display = 'none';
      btn.textContent = '展开全站主题颜色设置 ▸';
    }
  });
}

function refreshRoomTable(token, rooms) {
  const roomCount = document.querySelector('#roomCount');
  const tbody = document.querySelector('#roomTableBody');
  if (roomCount) roomCount.textContent = rooms.length;
  if (tbody) tbody.innerHTML = renderRoomTableRows(rooms);
  bindRoomDeleteButtons(token);
  bindRoomEditor(token);
  bindStreamEditor(token);
}

function bindRoomCreateButton(token) {
  const btn = document.querySelector('#btnAddRoom');
  if (!btn) return;
  btn.addEventListener('click', async function () {
    const title = prompt('请输入新房间标题：', '新直播间');
    if (!title) return;

    const result = await adminCreateRoom({
      title: title.trim(),
      category: 'football',
      status: 'offline',
      anchorName: '',
      announcement: '',
      sortOrder: 99
    }, token);

    if (!result || !result.ok) {
      alert('新增失败：' + ((result && result.error) ? result.error : '未知错误'));
      return;
    }

    const data = await adminGetRooms(token);
    if (data && data.ok && data.rooms) {
      refreshRoomTable(token, data.rooms);
      alert('新增房间成功');
    } else {
      alert('新增成功，但刷新房间列表失败，请刷新页面');
    }
  });
}

function bindRoomDeleteButtons(token) {
  document.querySelectorAll('.btn-room-delete').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const roomId = parseInt(this.dataset.roomId);
      const title = this.dataset.roomTitle || ('房间 #' + roomId);

      if (!confirm('确定删除「' + title + '」吗？该房间下的播放源也会一起删除。')) return;

      const result = await adminDeleteRoom(roomId, token);
      if (!result || !result.ok) {
        alert('删除失败：' + ((result && result.error) ? result.error : '未知错误'));
        return;
      }

      const data = await adminGetRooms(token);
      if (data && data.ok && data.rooms) {
        refreshRoomTable(token, data.rooms);
        const roomEditor = document.querySelector('#roomEditor');
        const streamEditor = document.querySelector('#streamEditor');
        if (roomEditor) { roomEditor.style.display = 'none'; roomEditor.innerHTML = ''; }
        if (streamEditor) { streamEditor.style.display = 'none'; streamEditor.innerHTML = ''; }
        alert('房间已删除');
      } else {
        alert('删除成功，但刷新房间列表失败，请刷新页面');
      }
    });
  });
}

function bindRoomEditor(token) {
  document.querySelectorAll('.btn-room-edit').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var roomId = parseInt(this.dataset.roomId);
      var data = await adminGetRooms(token);
      if (!data || !data.ok) { alert('获取房间数据失败'); return; }
      var room = data.rooms.find(function (r) { return r.id === roomId; });
      if (!room) { alert('房间不存在'); return; }
      var streamEditor = document.querySelector('#streamEditor');
      if (streamEditor) { streamEditor.style.display = 'none'; streamEditor.innerHTML = ''; }
      var editor = document.querySelector('#roomEditor');
      if (editor) {
        editor.style.display = 'block';
        editor.innerHTML = renderRoomEditor(room);
        bindRoomSaveButton(token, roomId);
      }
    });
  });
}

function bindRoomSaveButton(token, roomId) {
  var saveBtn = document.querySelector('.btn-room-save');
  if (!saveBtn) return;

  var coverInput = document.querySelector('.re-cover');
  var coverImg = document.querySelector('.re-cover-preview-img');
  var coverStatus = document.querySelector('.re-cover-preview-status');
  if (coverInput && coverImg) {
    var updateCoverPreview = function () {
      var src = coverPreviewSrc(coverInput.value);
      if (!src) {
        coverImg.removeAttribute('src');
        coverImg.style.display = 'none';
        if (coverStatus) coverStatus.textContent = '未填写封面图片地址';
        return;
      }
      coverImg.style.display = 'block';
      coverImg.src = src;
      if (coverStatus) coverStatus.textContent = '图片预览';
    };
    coverImg.addEventListener('error', function () {
      if (coverStatus) coverStatus.textContent = '图片加载失败';
    });
    coverImg.addEventListener('load', function () {
      if (coverStatus) coverStatus.textContent = '图片预览';
    });
    coverInput.addEventListener('input', updateCoverPreview);
    updateCoverPreview();
  }

  saveBtn.addEventListener('click', async function () {
    var msgEl = document.querySelector('.room-save-msg');
    if (msgEl) msgEl.textContent = '保存中...';
    var gv = function (sel) { var el = document.querySelector(sel); return el ? el.value : ''; };
    var data = { title: gv('.re-title'), category: gv('.re-category'), status: gv('.re-status'), cover: gv('.re-cover'), anchor_name: gv('.re-anchor'), announcement: gv('.re-announcement'), sort_order: parseInt(gv('.re-sort')) || 0 };
    var result = await adminUpdateRoom(roomId, data, token);
    if (result && result.ok) {
      try {
        var roomsData = await adminGetRooms(token);
        var roomCount = document.querySelector('#roomCount');
        var tbody = document.querySelector('#roomTableBody');
        if (roomsData && roomsData.ok && roomsData.rooms) {
          if (roomCount) roomCount.textContent = roomsData.rooms.length;
          if (tbody) tbody.innerHTML = renderRoomTableRows(roomsData.rooms);
          bindRoomEditor(token);
          bindStreamEditor(token);
          if (msgEl) { msgEl.textContent = '已保存，房间列表已更新'; msgEl.style.color = 'var(--success)'; }
        } else {
          if (msgEl) { msgEl.textContent = '已保存，但房间列表刷新失败'; msgEl.style.color = 'var(--success)'; }
        }
      } catch (e) {
        if (msgEl) { msgEl.textContent = '已保存，但房间列表刷新失败'; msgEl.style.color = 'var(--success)'; }
      }
    }
    else {
      if (msgEl) {
        msgEl.textContent = '保存失败：' + ((result && result.error) ? result.error : '未知错误');
        msgEl.style.color = 'var(--danger)';
      }
    }
    setTimeout(function () { if (msgEl) msgEl.textContent = ''; }, 5000);
  });
}

function bindStreamEditor(token) {
  document.querySelectorAll('.btn-stream-mgr').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var roomId = parseInt(this.dataset.roomId);
      var data = await adminGetRooms(token);
      if (!data || !data.ok) { alert('获取房间数据失败'); return; }
      var room = data.rooms.find(function (r) { return r.id === roomId; });
      if (!room) { alert('房间不存在'); return; }
      var roomEditor = document.querySelector('#roomEditor');
      if (roomEditor) { roomEditor.style.display = 'none'; roomEditor.innerHTML = ''; }
      var editor = document.querySelector('#streamEditor');
      if (editor) {
        editor.style.display = 'block';
        editor.innerHTML = renderStreamEditor(room, room.streams);
        bindStreamCreateButtons(token, roomId);
        bindStreamSaveButtons(token, roomId);
        bindAdvToggles();
      }
    });
  });
}

function bindAdvToggles() {
  document.querySelectorAll('.btn-stream-toggle-adv').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = this.dataset.advId;
      var panel = document.getElementById(id);
      if (!panel) return;
      if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        this.textContent = '收起高级配置 ▾';
      } else {
        panel.style.display = 'none';
        this.textContent = '展开高级配置 ▸';
      }
    });
  });
}

function bindStreamCreateButtons(token, roomId) {
  document.querySelectorAll('.btn-stream-add').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var type = this.dataset.type || 'hls';
      var name = type === 'flv' ? '极速线路 FLV' : '主线路 HLS';
      var url = prompt('请输入' + name + '播放地址：', '');
      if (!url) return;

      var result = await adminCreateStream(roomId, {
        name: name,
        type: type,
        url: url.trim(),
        enabled: 1,
        is_default: 0
      }, token);

      if (!result || !result.ok) {
        alert('新增失败：' + ((result && result.error) ? result.error : '未知错误'));
        return;
      }

      var data = await adminGetRooms(token);
      if (!data || !data.ok) {
        alert('新增成功，但刷新播放源失败，请刷新页面');
        return;
      }

      var room = data.rooms.find(function (r) { return r.id === roomId; });
      var editor = document.querySelector('#streamEditor');
      if (room && editor) {
        editor.innerHTML = renderStreamEditor(room, room.streams);
        bindStreamCreateButtons(token, roomId);
        bindStreamSaveButtons(token, roomId);
      }
    });
  });
}

function bindStreamSaveButtons(token, roomId) {
  document.querySelectorAll('.btn-stream-test').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = this.closest('.stream-edit-item');
      if (!item) return;
      var input = item.querySelector('.se-url');
      var url = input ? input.value.trim() : '';
      if (!url) {
        alert('请先填写播放地址');
        return;
      }
      window.open(url, '_blank', 'noopener');
    });
  });

  document.querySelectorAll('.btn-stream-delete').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var streamId = parseInt(this.dataset.streamId);
      if (!confirm('确定删除这个播放源吗？删除后不可恢复。')) return;

      var result = await adminDeleteStream(roomId, streamId, token);
      if (!result || !result.ok) {
        alert('删除失败：' + ((result && result.error) ? result.error : '未知错误'));
        return;
      }

      var data = await adminGetRooms(token);
      var room = data && data.ok ? data.rooms.find(function (r) { return r.id === roomId; }) : null;
      var editor = document.querySelector('#streamEditor');
      if (room && editor) {
        editor.innerHTML = renderStreamEditor(room, room.streams);
        bindStreamCreateButtons(token, roomId);
        bindStreamSaveButtons(token, roomId);
      } else {
        alert('删除成功，请刷新页面查看');
      }
    });
  });

  document.querySelectorAll('.btn-stream-save').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var streamId = parseInt(this.dataset.streamId);
      var item = this.closest('.stream-edit-item');
      if (!item) return;
      var msgEl = item.querySelector('.stream-save-msg');
      if (msgEl) msgEl.textContent = '保存中...';
      var gv = function (sel) { var el = item.querySelector(sel); return el ? el.value : ''; };
      var gc = function (sel) { var el = item.querySelector(sel); return el ? el.checked : false; };
      var data = { name: gv('.se-name'), type: gv('.se-type'), url: gv('.se-url'), enabled: gc('.se-enabled') ? 1 : 0, is_default: gc('.se-is-default') ? 1 : 0 };
      var result = await adminUpdateStream(roomId, streamId, data, token);
      if (result && result.ok) { if (msgEl) { msgEl.textContent = '已保存'; msgEl.style.color = 'var(--success)'; } }
      else { if (msgEl) { msgEl.textContent = '保存失败'; msgEl.style.color = 'var(--danger)'; } }
      setTimeout(function () { if (msgEl) msgEl.textContent = ''; }, 3000);
    });
  });
}

export function bindAdminEvents() {
  const token = localStorage.getItem('admin_token');

  // Theme toggle
  bindThemeToggle();

  if (token) {
    (async () => {
      const info = await adminGetMe(token);
      const userEl = document.querySelector('#adminUsername');
      if (info && info.ok) {
        if (userEl) userEl.textContent = '管理员: ' + info.admin.username;
        const apiEl = document.querySelector('#apiStatus');
        if (apiEl) apiEl.innerHTML = '<span style="color:var(--success);">已连接后端 API</span>';
      } else {
        if (userEl) userEl.textContent = '身份验证失败，请重新登录';
        localStorage.removeItem('admin_token');
        location.reload();
        return;
      }

      const roomsData = await adminGetRooms(token);
      const roomCount = document.querySelector('#roomCount');
      const tbody = document.querySelector('#roomTableBody');
      if (roomsData && roomsData.ok && roomsData.rooms) {
        if (roomCount) roomCount.textContent = roomsData.rooms.length;
        if (tbody) tbody.innerHTML = renderRoomTableRows(roomsData.rooms);
        bindRoomCreateButton(token);
        bindRoomDeleteButtons(token);
        bindRoomEditor(token);
        bindStreamEditor(token);
      } else {
        if (roomCount) roomCount.textContent = '加载失败';
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--danger);">加载失败</td></tr>';
      }
    })();

    const logoutBtn = document.querySelector('#btnAdminLogout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.removeItem('admin_token'); location.reload(); });
  } else {
    const loginBtn = document.querySelector('#btnAdminLogin');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const user = document.querySelector('#adminUser').value.trim();
        const pass = document.querySelector('#adminPass').value.trim();
        const errEl = document.querySelector('#adminError');
        if (!user || !pass) { if (errEl) errEl.textContent = '请输入用户名和密码'; return; }
        if (errEl) errEl.textContent = '登录中...';
        const result = await adminLogin(user, pass);
        if (result && result.ok) { localStorage.setItem('admin_token', result.token); location.reload(); }
        else { if (errEl) errEl.textContent = '用户名或密码错误'; }
      });
    }
  }

  const saveBtn = document.querySelector('#saveTheme');
  if (saveBtn) saveBtn.addEventListener('click', () => { const data = {}; document.querySelectorAll('[data-var]').forEach(i => { data[i.dataset.var] = i.value.trim(); document.documentElement.style.setProperty(i.dataset.var, i.value.trim()); }); localStorage.setItem('themeOverride', JSON.stringify(data)); alert('已保存到本机预览'); });
  const resetBtn = document.querySelector('#resetTheme');
  if (resetBtn) resetBtn.addEventListener('click', () => { localStorage.removeItem('themeOverride'); location.reload(); });
}
