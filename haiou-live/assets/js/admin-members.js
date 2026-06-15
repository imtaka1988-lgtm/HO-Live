function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function adminToken() {
  return localStorage.getItem('admin_token') || '';
}

async function apiJson(path, options) {
  const res = await fetch(path, {
    ...(options || {}),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + adminToken(),
      ...((options && options.headers) || {})
    }
  });
  return res.json();
}

function memberCardHtml() {
  return `<div class="admin-card" id="adminMemberCard">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
      <div>
        <h2 style="margin:0;">会员管理</h2>
        <p style="color:#999;margin:6px 0 0;font-size:12px;">只展示会员账号资料；原密码不可查看，只能重置新密码。</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input id="memberSearchInput" placeholder="手机号 / 昵称" style="height:32px;padding:0 10px;border:1px solid #ddd;border-radius:6px;min-width:190px;">
        <button id="btnMemberSearch" type="button" style="height:32px;padding:0 14px;border-radius:6px;background:#3b82f6;color:#fff;">查找</button>
        <button id="btnMemberRefresh" type="button" style="height:32px;padding:0 14px;border-radius:6px;background:#111827;color:#fff;">刷新</button>
      </div>
    </div>
    <div id="memberResetResult" style="display:none;margin:8px 0 10px;padding:10px;border:1px solid #fed7aa;background:#fff7ed;border-radius:8px;color:#9a3412;font-size:13px;"></div>
    <div id="memberListBox" style="overflow-x:auto;color:#666;font-size:13px;">加载中...</div>
  </div>`;
}

function statusText(status) {
  if (status === 'active') return '正常';
  if (status === 'blocked') return '限制';
  return status || '--';
}

function renderMembers(users) {
  if (!users || users.length === 0) {
    return '<div style="padding:14px;color:#999;text-align:center;">暂无会员</div>';
  }

  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:#f5f5f5;">
      <th style="padding:8px 10px;text-align:left;">ID</th>
      <th style="padding:8px 10px;text-align:left;">账号/手机号</th>
      <th style="padding:8px 10px;text-align:left;">昵称</th>
      <th style="padding:8px 10px;text-align:left;">等级</th>
      <th style="padding:8px 10px;text-align:left;">经验</th>
      <th style="padding:8px 10px;text-align:left;">状态</th>
      <th style="padding:8px 10px;text-align:left;">操作</th>
    </tr></thead>
    <tbody>${users.map(function (u) {
      return `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 10px;color:#9ca3af;font-weight:700;">${esc(u.id)}</td>
        <td style="padding:8px 10px;font-weight:700;">${esc(u.phone || '--')}</td>
        <td style="padding:8px 10px;">${esc(u.nickname || '--')}</td>
        <td style="padding:8px 10px;">LV.${esc(u.level || 0)}</td>
        <td style="padding:8px 10px;">${esc(u.coins || 0)}</td>
        <td style="padding:8px 10px;">${esc(statusText(u.status))}</td>
        <td style="padding:8px 10px;white-space:nowrap;">
          <button class="btn-member-reset" type="button" data-user-id="${esc(u.id)}" data-user-phone="${esc(u.phone || '')}" data-user-nickname="${esc(u.nickname || '')}" style="padding:5px 10px;border-radius:6px;background:#f97316;color:#fff;font-size:12px;">重置密码</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

async function loadMembers() {
  const box = document.querySelector('#memberListBox');
  const input = document.querySelector('#memberSearchInput');
  if (!box) return;
  const q = input ? input.value.trim() : '';
  box.innerHTML = '<div style="padding:14px;color:#999;text-align:center;">加载中...</div>';

  const data = await apiJson('/api/admin/users?q=' + encodeURIComponent(q));
  if (!data || !data.ok) {
    box.innerHTML = '<div style="padding:14px;color:#ef4444;text-align:center;">会员列表加载失败</div>';
    return;
  }
  box.innerHTML = renderMembers(data.users || []);
}

async function resetMemberPassword(btn) {
  const userId = btn.dataset.userId;
  const phone = btn.dataset.userPhone || '';
  const nickname = btn.dataset.userNickname || '';
  if (!userId) return;
  if (!confirm('确定重置会员「' + (nickname || phone || ('ID ' + userId)) + '」的密码吗？旧密码会立即失效。')) return;

  btn.disabled = true;
  btn.textContent = '重置中...';
  const data = await apiJson('/api/admin/users/' + encodeURIComponent(userId) + '/reset-password', { method: 'POST' });
  btn.disabled = false;
  btn.textContent = '重置密码';

  const result = document.querySelector('#memberResetResult');
  if (!data || !data.ok) {
    alert('重置失败：' + ((data && data.error) || '未知错误'));
    return;
  }

  const user = data.user || {};
  const text = '会员：' + (user.nickname || user.phone || user.id) + '\n账号：' + (user.phone || '') + '\n新密码：' + data.newPassword + '\n\n请立即复制保存，新密码只显示这一次。';
  if (result) {
    result.style.display = 'block';
    result.innerHTML = '<b>会员密码已重置</b><br>账号：<code>' + esc(user.phone || '') + '</code><br>新密码：<code style="font-weight:800;font-size:15px;">' + esc(data.newPassword) + '</code><br><span>请立即复制保存，新密码只显示这一次。</span>';
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(function () {});
  }
}

function bindMemberEvents() {
  const search = document.querySelector('#btnMemberSearch');
  const refresh = document.querySelector('#btnMemberRefresh');
  const input = document.querySelector('#memberSearchInput');

  if (search) search.addEventListener('click', loadMembers);
  if (refresh) refresh.addEventListener('click', function () {
    if (input) input.value = '';
    loadMembers();
  });
  if (input) input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') loadMembers();
  });

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.btn-member-reset');
    if (!btn) return;
    resetMemberPassword(btn);
  });
}

export function initAdminMembers() {
  if (document.body.dataset.page !== 'admin') return;
  if (!adminToken()) return;
  if (window.__adminMembersBound) return;
  window.__adminMembersBound = true;

  const wait = function () {
    const box = document.querySelector('.admin-box');
    if (!box) {
      setTimeout(wait, 120);
      return;
    }
    if (!document.querySelector('#adminMemberCard')) {
      box.insertAdjacentHTML('beforeend', memberCardHtml());
    }
    bindMemberEvents();
    loadMembers();
  };
  wait();
}
