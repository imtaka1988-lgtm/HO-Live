/**
 * 后台系统站内信发送卡片
 */

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, function (s) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s];
  });
}

function fmtTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function cardHtml() {
  return `<div class="admin-card" id="adminSiteMessageCard">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
      <h2 style="margin:0;">系统站内信</h2>
      <span style="font-size:12px;color:#999;font-weight:700;">用户进入“我的”会自动弹最新一条</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 110px 110px;gap:10px;align-items:end;">
      <label style="font-size:13px;font-weight:700;color:#555;">标题
        <input id="asmTitle" maxlength="80" placeholder="例如：系统通知" style="width:100%;height:34px;padding:0 10px;border:1px solid #ddd;border-radius:8px;">
      </label>
      <label style="font-size:13px;font-weight:700;color:#555;">排序
        <input id="asmSort" type="number" value="0" style="width:100%;height:34px;padding:0 10px;border:1px solid #ddd;border-radius:8px;">
      </label>
      <label style="display:flex;align-items:center;gap:6px;height:34px;font-size:13px;font-weight:700;color:#555;">
        <input id="asmEnabled" type="checkbox" checked> 启用
      </label>
    </div>
    <label style="display:block;margin-top:10px;font-size:13px;font-weight:700;color:#555;">内容
      <textarea id="asmContent" maxlength="500" placeholder="请输入站内信内容，最多 500 字" style="width:100%;min-height:92px;padding:10px;border:1px solid #ddd;border-radius:8px;resize:vertical;line-height:1.6;"></textarea>
    </label>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;">
      <button id="btnAsmSend" type="button" style="padding:8px 18px;background:#ff8a00;color:#fff;border-radius:999px;font-size:13px;font-weight:900;">发送站内信</button>
      <button id="btnAsmReload" type="button" style="padding:8px 14px;background:#e5e7eb;color:#111827;border-radius:999px;font-size:13px;font-weight:900;">刷新列表</button>
      <span id="asmStatus" style="font-size:12px;color:#999;"></span>
    </div>
    <div style="margin-top:16px;border-top:1px dashed #e5e7eb;padding-top:14px;">
      <h3 style="margin:0 0 10px;font-size:15px;">已发送站内信</h3>
      <div id="asmList" style="display:grid;gap:8px;color:#999;font-size:13px;">加载中...</div>
    </div>
  </div>`;
}

function messageListHtml(messages) {
  if (!messages || !messages.length) {
    return '<div style="padding:14px;border-radius:10px;background:#f8fafc;color:#999;text-align:center;">暂无站内信</div>';
  }

  return messages.map(function (m) {
    return `<div style="padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid #eef2f7;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px;">
        <b style="color:#111827;font-size:13px;">${esc(m.title)}</b>
        <span style="color:${m.isEnabled ? '#16a34a' : '#999'};font-size:12px;font-weight:900;">${m.isEnabled ? '启用' : '停用'}</span>
      </div>
      <div style="color:#4b5563;font-size:12px;line-height:1.55;">${esc(m.content)}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;">
        <span style="font-size:11px;color:#999;">#${m.id} · ${esc(fmtTime(m.createdAt))}</span>
        <button class="btnAsmDelete" data-id="${m.id}" type="button" style="padding:4px 9px;background:#fee2e2;color:#b91c1c;border-radius:999px;font-size:11px;font-weight:900;">删除</button>
      </div>
    </div>`;
  }).join('');
}

async function fetchMessages(token) {
  const res = await fetch('/api/admin/site-messages', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return res.json();
}

async function createMessage(token, payload) {
  const res = await fetch('/api/admin/site-messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function deleteMessage(token, id) {
  const res = await fetch('/api/admin/site-messages/' + id, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });
  return res.json();
}

async function loadMessages(token) {
  const list = document.querySelector('#asmList');
  const status = document.querySelector('#asmStatus');
  if (list) list.textContent = '加载中...';
  try {
    const data = await fetchMessages(token);
    if (!data || !data.ok) throw new Error(data && data.error ? data.error : 'load failed');
    if (list) list.innerHTML = messageListHtml(data.messages || []);
    document.querySelectorAll('.btnAsmDelete').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const id = this.dataset.id;
        if (!confirm('确定删除这条站内信吗？')) return;
        const result = await deleteMessage(token, id);
        if (!result || !result.ok) {
          alert('删除失败：' + ((result && result.error) ? result.error : '未知错误'));
          return;
        }
        await loadMessages(token);
      });
    });
    if (status) status.textContent = '';
  } catch (e) {
    if (list) list.innerHTML = '<div style="color:#b91c1c;">站内信列表加载失败</div>';
    if (status) status.textContent = '加载失败';
  }
}

function bindCard(token) {
  const sendBtn = document.querySelector('#btnAsmSend');
  const reloadBtn = document.querySelector('#btnAsmReload');
  const status = document.querySelector('#asmStatus');

  if (sendBtn) {
    sendBtn.addEventListener('click', async function () {
      const title = (document.querySelector('#asmTitle')?.value || '').trim();
      const content = (document.querySelector('#asmContent')?.value || '').trim();
      const sortOrder = parseInt(document.querySelector('#asmSort')?.value || '0', 10) || 0;
      const isEnabled = !!document.querySelector('#asmEnabled')?.checked;

      if (!title) { alert('请输入站内信标题'); return; }
      if (!content) { alert('请输入站内信内容'); return; }
      if (status) status.textContent = '发送中...';

      const result = await createMessage(token, { title, content, sortOrder, isEnabled });
      if (!result || !result.ok) {
        if (status) status.textContent = '发送失败：' + ((result && result.error) ? result.error : '未知错误');
        return;
      }

      if (status) status.textContent = '已发送，用户进入“我的”会弹窗看到最新站内信';
      const contentEl = document.querySelector('#asmContent');
      if (contentEl) contentEl.value = '';
      await loadMessages(token);
    });
  }

  if (reloadBtn) reloadBtn.addEventListener('click', () => loadMessages(token));
}

export function initAdminSiteMessages() {
  if (document.body.dataset.page !== 'admin') return;
  const token = localStorage.getItem('admin_token');
  if (!token) return;
  if (document.querySelector('#adminSiteMessageCard')) return;
  const box = document.querySelector('.admin-box');
  if (!box) return;
  const statusCard = box.querySelector('.admin-login-status');
  const wrap = document.createElement('div');
  wrap.innerHTML = cardHtml();
  const card = wrap.firstElementChild;
  if (statusCard && statusCard.nextSibling) {
    box.insertBefore(card, statusCard.nextSibling);
  } else {
    box.appendChild(card);
  }
  bindCard(token);
  loadMessages(token);
}
