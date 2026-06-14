/**
 * 管理后台：每个房间下方展示并维护主播后台账号与 OBS 信息。
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
    .admin-anchor-panel-item code,
    .admin-anchor-panel-item input {
      width: 100%;
      box-sizing: border-box;
      display: block;
      min-height: 34px;
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .admin-anchor-panel-item code {
      background: #111827;
      color: #fde68a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .admin-anchor-panel-item input {
      border: 1px solid #d1d5db;
      background: #fff;
      color: #111827;
      outline: none;
    }
    .admin-anchor-action {
      height: 32px;
      padding: 0 12px;
      border-radius: 8px;
      border: 0;
      color: #fff;
      background: #f97316;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      white-space: nowrap;
    }
    .admin-anchor-action.is-dark { background: #111827; }
    .admin-anchor-action.is-blue { background: #2563eb; }
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
    .admin-anchor-ok {
      color: #166534;
      background: #dcfce7;
      border-color: #bbf7d0;
    }
    @media (max-width: 768px) {
      .admin-anchor-panel-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function removeInlineRows() {
  document.querySelectorAll('.admin-room-inline-editor-row').forEach(function (row) { row.remove(); });
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

function itemCode(label, value, className) {
  return `<div class="admin-anchor-panel-item"><label>${esc(label)}</label><code class="${className || ''}" title="${esc(value || '')}">${esc(value || '未生成')}</code></div>`;
}

function itemInput(label, value, className, placeholder) {
  return `<div class="admin-anchor-panel-item"><label>${esc(label)}</label><input class="${className || ''}" value="${esc(value || '')}" placeholder="${esc(placeholder || '')}"></div>`;
}

function renderPanel(roomId, bundle) {
  const anchor = bundle.anchor || null;
  const stream = bundle.streamProfile || {};
  const password = bundle.generatedPassword || '';
  const saveTip = bundle.saved ? '<div class="admin-anchor-tip admin-anchor-ok">OBS 信息已保存。主播后台会展示你这里保存的服务器和推流码。</div>' : '';
  const passwordTip = password ? `<div class="admin-anchor-tip">主播新密码：<b class="anchor-generated-password">${esc(password)}</b>。请立即复制保存，关闭后不再显示。</div>` : '<div class="admin-anchor-tip">密码已加密保存，后台无法查看原密码。需要发给主播时，请先点击“重置主播密码”。</div>';

  if (!anchor) {
    return `<div class="admin-anchor-panel-card">
      <div class="admin-anchor-panel-head"><div><h3>房间 #${esc(roomId)} 主播后台</h3><p>该房间还没有主播账号。</p></div></div>
      <div class="admin-anchor-actions"><button class="admin-anchor-action is-dark" data-anchor-generate="${esc(roomId)}">生成主播账号</button></div>
      <div class="admin-anchor-tip">老房间可以在这里补生成主播账号。生成后主播只能管理这个房间。</div>
    </div>`;
  }

  return `<div class="admin-anchor-panel-card" data-anchor-room-id="${esc(roomId)}">
    <div class="admin-anchor-panel-head"><div><h3>房间 #${esc(roomId)} 主播后台</h3><p>这里设置的是给主播看的 OBS 推流信息，播放地址不展示给主播。</p></div></div>
    <div class="admin-anchor-panel-grid">
      ${itemCode('主播账号', anchor.username, 'anchor-username')}
      ${itemCode('主播状态', anchor.status, '')}
      ${itemInput('OBS 服务器', stream.obsServer || '', 'anchor-obs-server', '例如：rtmp://push.haiolive.cn/live')}
      ${itemInput('OBS 推流码', stream.obsStreamKey || '', 'anchor-obs-key', '例如：room1 或带鉴权的推流码')}
    </div>
    <div class="admin-anchor-actions">
      <button class="admin-anchor-action is-blue" data-anchor-save-obs="${esc(roomId)}">保存 OBS 信息</button>
      <button class="admin-anchor-action" data-anchor-reset="${esc(roomId)}">重置主播密码</button>
      <button class="admin-anchor-action is-dark" data-anchor-copy-all="${esc(roomId)}">复制四项发给主播</button>
    </div>
    ${saveTip}
    ${passwordTip}
  </div>`;
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

async function saveObs(roomId) {
  const card = document.querySelector('.admin-anchor-panel-card[data-anchor-room-id="' + roomId + '"]');
  if (!card) return;
  const obsServer = (card.querySelector('.anchor-obs-server') || {}).value || '';
  const obsStreamKey = (card.querySelector('.anchor-obs-key') || {}).value || '';
  const currentPassword = (card.querySelector('.anchor-generated-password') || {}).textContent || '';
  const data = await apiJson('/api/admin/rooms/' + encodeURIComponent(roomId) + '/anchor-bundle/stream-profile', {
    method: 'PUT',
    body: JSON.stringify({ obsServer, obsStreamKey })
  });
  if (!data || !data.ok) {
    alert('保存失败：' + ((data && data.error) || '未知错误'));
    return;
  }
  if (currentPassword) data.generatedPassword = currentPassword;
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

function copyForAnchor(roomId) {
  const card = document.querySelector('.admin-anchor-panel-card[data-anchor-room-id="' + roomId + '"]');
  if (!card) return;
  const username = (card.querySelector('.anchor-username') || {}).textContent || '';
  const password = (card.querySelector('.anchor-generated-password') || {}).textContent || '';
  const obsServer = (card.querySelector('.anchor-obs-server') || {}).value || '';
  const obsKey = (card.querySelector('.anchor-obs-key') || {}).value || '';

  if (!password) {
    alert('当前密码不可查看。请先点击“重置主播密码”，生成新密码后再复制给主播。');
    return;
  }
  if (!obsServer || !obsKey) {
    alert('请先填写并保存 OBS 服务器和 OBS 推流码。');
    return;
  }

  const text = [
    '主播后台账号：' + username,
    '主播后台密码：' + password,
    'OBS 服务器：' + obsServer,
    'OBS 推流码：' + obsKey
  ].join('\n');

  navigator.clipboard.writeText(text).then(function () {
    alert('已复制，可以直接发给主播。');
  }).catch(function () {
    window.prompt('复制下面内容发给主播：', text);
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

    const save = e.target.closest && e.target.closest('[data-anchor-save-obs]');
    if (save) {
      saveObs(save.dataset.anchorSaveObs);
      return;
    }

    const reset = e.target.closest && e.target.closest('[data-anchor-reset]');
    if (reset) {
      resetPassword(reset.dataset.anchorReset);
      return;
    }

    const copyAll = e.target.closest && e.target.closest('[data-anchor-copy-all]');
    if (copyAll) copyForAnchor(copyAll.dataset.anchorCopyAll);
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
