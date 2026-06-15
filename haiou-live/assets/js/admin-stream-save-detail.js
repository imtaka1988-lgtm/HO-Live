import { adminUpdateStream } from './api.js';

function currentStreamEditorRoomId() {
  const title = document.querySelector('#streamEditor h3');
  const text = title ? title.textContent : '';
  const m = text.match(/房间\s*#(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function streamPayload(item) {
  const gv = function (sel) {
    const el = item.querySelector(sel);
    return el ? String(el.value || '').trim() : '';
  };
  const gc = function (sel) {
    const el = item.querySelector(sel);
    return !!(el && el.checked);
  };

  return {
    name: gv('.se-name'),
    type: gv('.se-type'),
    url: gv('.se-url'),
    enabled: gc('.se-enabled') ? 1 : 0,
    is_default: gc('.se-is-default') ? 1 : 0
  };
}

export function initAdminStreamSaveDetail() {
  if (document.body.dataset.page !== 'admin') return;
  if (window.__adminStreamSaveDetailInstalled) return;
  window.__adminStreamSaveDetailInstalled = true;

  document.addEventListener('click', async function (e) {
    const btn = e.target.closest && e.target.closest('.btn-stream-save');
    if (!btn) return;

    const editor = document.querySelector('#streamEditor');
    if (!editor || !editor.contains(btn)) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const token = localStorage.getItem('admin_token') || '';
    const roomId = currentStreamEditorRoomId();
    const streamId = parseInt(btn.dataset.streamId, 10);
    const item = btn.closest('.stream-edit-item');
    const msgEl = item && item.querySelector('.stream-save-msg');

    if (!token || !roomId || !streamId || !item) {
      if (msgEl) {
        msgEl.textContent = '保存失败：缺少房间或播放源信息，请刷新后台再试';
        msgEl.style.color = 'var(--danger)';
      }
      return;
    }

    const data = streamPayload(item);
    if (!data.name || !data.type || !data.url) {
      if (msgEl) {
        msgEl.textContent = '保存失败：线路名称、播放类型、播放地址必填';
        msgEl.style.color = 'var(--danger)';
      }
      return;
    }

    btn.disabled = true;
    if (msgEl) {
      msgEl.textContent = '保存中...';
      msgEl.style.color = '#6b7280';
    }

    const result = await adminUpdateStream(roomId, streamId, data, token);
    btn.disabled = false;

    if (result && result.ok) {
      if (msgEl) {
        msgEl.textContent = '已保存';
        msgEl.style.color = 'var(--success)';
      }
    } else if (msgEl) {
      msgEl.textContent = '保存失败：' + ((result && result.error) ? result.error : '未知错误');
      msgEl.style.color = 'var(--danger)';
    }

    setTimeout(function () {
      if (msgEl) msgEl.textContent = '';
    }, 6000);
  }, true);
}
