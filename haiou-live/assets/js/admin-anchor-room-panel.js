/**
 * 管理后台：每个房间下方展示主播后台账号与 OBS 信息。
 */

let bound = false;

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
  });
}

function token() {
  return localStorage.getItem('admin_token') || '';
}

async function apiJson(path, options) {
  const res = await fetch(path, {
    ...(options || {}),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token(),
      ...((options && options.headers) || {})
    }
  });
  return res.json();
}

function injectStyle() {
  if (document.querySelector('#adminAnchorRoomPanelStyle')) return;
  const style = document.createElement('style');
  style.id = 'adminAnchorRoomPanelStyle';
  style.textContent = `
    .btn-anchor-bundle {
      padding: 4px 8px;
      font-size: 11px;
      background: #111827;
      color: #fff;
      border-radius: 4px;
      margin-right: 4px;
    }
    .admin-anchor-panel-card {
      margin: 8px 0 0;
      border: 1px solid #c7d2fe;
      border-radius: 10px;
      background: #fff;
      padding: 14px;
    }
    .admin-anchor-panel-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }
    .admin-anchor-panel-head h3 {
      margin: 0 0 4px;
      font-size: 16px;
    }
    .admin-anchor-panel-head p {
      margin: 0;
      color: #6b7280;
      font-size: 12px;
    }
    .admin-anchor-panel-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .admin-anchor-panel-item {
      border: 1px solid #e5e7eb;
      background: #f9fafb;
      border-radius: 10px;
      padding: 10px;
    }
    .admin-anchor-panel-item label {
      display: block;
      font-size: 12px;
      color: #6b7280;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .admin-anchor-panel-value {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .admin-anchor-panel-value code {
      flex: 1;
      min-width: 0;
      padding: 6px 8px;
      border-radius: 7px;
      background: #111827;
      color: #fde68a;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .admin-anchor-copy,
    .admin-anchor-action {
      height: 30px;
      padding: 0 10px;
      border-radius: 7px;
      border: 0;
      color: #fff;
      background: #f97316;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      white-space: nowrap;
    }
    .admin-anchor-action.is-dark {
      background: #111827;
    }
    .admin-anchor-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .admin-anchor-tip {
      margin: 12px 0 0;
      color: #9a3412;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 10px;
      padding: 9px 10px;
      font-size: 12px;
      line-height: 1.5;
    }
    @media (max-width: 768px) {
      .admin-anchor-panel-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function valueRow(label, value) {
  const text = String(value || '未配置');
  return `<div class="admin-anchor-panel-item">
    <label>${esc(label)}</label>
    <div class="admin-anchor-panel-value"><code title="${esc(text)}">${esc(text)}</code><button class="admin-anchor-copy" data-copy="${esc(text)}" ${value ? '' : 'disabled'}>复制</button></div>
  </div>`;
}

function removeInlineRows() {
  document.querySelectorAll('.admin-room-inline-editor-row').forEach(function (row) { row.remove(); });
}

function findHls(bundle) {
  const stream = bundle.streamProfile || {};
  if (stream.pullHlsUrl) return stream.pullHlsUrl;
  const list = Array.isArray(bundle.playbackStreams) ? bundle.playbackStreams : [];
  const hls = list.find(function (x) { return x.type === 'hls'; });
  return hls ? hls.url : '';
}

function renderPanel(roomId, bundle) {
  const anchor = bundle.anchor || null;
  const stream = bundle.streamProfile || {};
  const hls = findHls(bundle);
  const passwordTip = bundle.generatedPassword ? `<div class="admin-anchor-tip">新密码：<b>${esc(bundle.generatedPassword)}</b>。请立即复制保存，关闭后不再显示。</div>` : '';

  if (!anchor) {
    return `<div class="admin-anchor-panel-card">
      <div class="admin-anchor-panel-head"><div><h3>房间 #${esc(roomId)} 主播后台</h3><p>该房间还没有主播账号。</p></div></div>
      <div class="admin-anchor-actions"><button class="admin-anchor-action is-dark" data-anchor-generate="${esc(roomId)}">生成主播账号</button></div>
      <div class="admin-anchor-tip">老房间可以在这里补生成主播账号。生成后主播只能管理这个房间。</div>
    </div>`;
  }

  return `<div class="admin-anchor-panel-card">
    <div class="admin-anchor-panel-head"><div><h3>房间 #${esc(roomId)} 主播后台</h3><p>主播只能管理当前房间，播放源和系统配置仍由管理员控制。</p></div></div>
    <div class="admin-anchor-panel-grid">
      ${valueRow('主播账号', anchor.username)}
      ${valueRow('主播状态', anchor.status)}
      ${valueRow('OBS 服务器', stream.obsServer)}
      ${valueRow('OBS 推流码', stream.obsStreamKey || stream.streamName)}
      ${valueRow('推流名 streamName', stream.streamName)}
      ${valueRow('HLS 播放地址', hls)}
    </div>
    <div class="admin-anchor-actions">
      <button class="admin-anchor-action" data-anchor-reset="${esc(roomId)}">重置主播密码</button>
    </div>
    ${passwordTip}
  </div>`;
}

function placePanel(roomId, html) {
  const tbody = document.querySelector('#roomTableBody');
  const row = tbody ? tbody.querySelector('tr[data-room-id="' + roomId + '"]') : null;
  if (!tbody || !row) return;
  removeInlineRows();
  const wrap = document.createElement('tr');
  wrap.className = 'admin-room-inline-editor-row admin-anchor-bundle-row';
  wrap.innerHTML = '<td colspan="7" style="padding:0 8px 14px;background:#eef2ff;border-bottom:1px solid #c7d2fe;">' + html + '</td>';
  row.insertAdjacentElement('afterend', wrap);
}

async function openPanel(roomId) {
  placePanel(roomId, '<div class="admin-anchor-panel-card">加载主播后台信息...</div>');
  const data = await apiJson('/api/admin/rooms/' + encodeURIComponent(roomId) + '/anchor-bundle');
  if (!data || !data.ok) {
    placePanel(roomId, '<div class="admin-anchor-panel-card">加载失败：' + esc((data && data.error) || '未知错误') + '</div>');
    return;
  }
  placePanel(roomId, renderPanel(roomId, data));
}

async function generateAnchor(roomId) {
  const data = await apiJson('/api/admin/rooms/' + encodeURIComponent(roomId) + '/anchor-bundle', { method: 'POST' });
  if (!data || !data.ok) {
    alert('生成失败：' + ((data && data.error) || '未知错误'));
    return;
  }
  placePanel(roomId, renderPanel(roomId, data));
}

async function resetPassword(roomId) {
  if (!confirm('确定重置这个主播的密码吗？旧密码会立即失效。')) return;
  const data = await apiJson('/api/admin/rooms/' + encodeURIComponent(roomId) + '/anchor-bundle/reset-password', { method: 'POST' });
  if (!data || !data.ok) {
    alert('重置失败：' + ((data && data.error) || '未知错误'));
    return;
  }
  placePanel(roomId, renderPanel(roomId, data));
}

function copyText(value, btn) {
  const text = String(value || '');
  if (!text || text === '未配置') return;
  navigator.clipboard.writeText(text).then(function () {
    const old = btn.textContent;
    btn.textContent = '已复制';
    setTimeout(function () { btn.textContent = old; }, 1200);
  }).catch(function () {
    window.prompt('复制下面内容：', text);
  });
}

function addButtons() {
  document.querySelectorAll('#roomTableBody tr[data-room-id]').forEach(function (row) {
    if (row.querySelector('.btn-anchor-bundle')) return;
    const cell = row.children[row.children.length - 1];
    if (!cell) return;
    const btn = document.createElement('button');
    btn.className = 'btn-anchor-bundle';
    btn.type = 'button';
    btn.dataset.roomId = row.dataset.roomId;
    btn.textContent = '主播后台';
    const deleteBtn = cell.querySelector('.btn-room-delete');
    if (deleteBtn) cell.insertBefore(btn, deleteBtn);
    else cell.appendChild(btn);
  });
}

export function initAdminAnchorRoomPanel() {
  if (bound || document.body.dataset.page !== 'admin') return;
  bound = true;
  injectStyle();
  addButtons();

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.btn-anchor-bundle');
    if (btn) {
      openPanel(btn.dataset.roomId);
      return;
    }

    const gen = e.target.closest && e.target.closest('[data-anchor-generate]');
    if (gen) {
      generateAnchor(gen.dataset.anchorGenerate);
      return;
    }

    const reset = e.target.closest && e.target.closest('[data-anchor-reset]');
    if (reset) {
      resetPassword(reset.dataset.anchorReset);
      return;
    }

    const copy = e.target.closest && e.target.closest('.admin-anchor-copy');
    if (copy) copyText(copy.dataset.copy, copy);
  });

  const observer = new MutationObserver(addButtons);
  const watch = function () {
    const tbody = document.querySelector('#roomTableBody');
    if (!tbody) {
      setTimeout(watch, 200);
      return;
    }
    observer.observe(tbody, { childList: true, subtree: true });
    addButtons();
  };
  watch();
}
