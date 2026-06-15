import { adminUpdateStream } from './api.js';

function currentStreamEditorRoomId() {
  const title = document.querySelector('#streamEditor h3');
  const text = title ? title.textContent : '';
  const m = text.match(/房间\s*#(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function urlPath(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, location.href).pathname.toLowerCase();
  } catch (e) {
    return raw.split('?')[0].split('#')[0].toLowerCase();
  }
}

function inferTypeFromUrl(url, fallbackType) {
  const path = urlPath(url);
  if (/\.flv$/i.test(path)) return 'flv';
  if (/\.m3u8$/i.test(path)) return 'hls';
  const fallback = String(fallbackType || '').toLowerCase();
  return fallback === 'flv' ? 'flv' : 'hls';
}

function syncTypeSelectByUrl(item) {
  if (!item) return;
  const urlInput = item.querySelector('.se-url');
  const typeSelect = item.querySelector('.se-type');
  if (!urlInput || !typeSelect) return;
  const nextType = inferTypeFromUrl(urlInput.value, typeSelect.value);
  if (nextType && typeSelect.value !== nextType) {
    typeSelect.value = nextType;
  }
}

function streamPayload(item) {
  syncTypeSelectByUrl(item);

  const gv = function (sel) {
    const el = item.querySelector(sel);
    return el ? String(el.value || '').trim() : '';
  };
  const gc = function (sel) {
    const el = item.querySelector(sel);
    return !!(el && el.checked);
  };

  const url = gv('.se-url');
  const type = inferTypeFromUrl(url, gv('.se-type'));

  return {
    name: gv('.se-name'),
    type: type,
    url: url,
    enabled: gc('.se-enabled') ? 1 : 0,
    is_default: gc('.se-is-default') ? 1 : 0
  };
}

export function initAdminStreamSaveDetail() {
  if (document.body.dataset.page !== 'admin') return;
  if (window.__adminStreamSaveDetailInstalled) return;
  window.__adminStreamSaveDetailInstalled = true;

  document.addEventListener('input', function (e) {
    const input = e.target.closest && e.target.closest('.se-url');
    if (!input) return;
    const item = input.closest('.stream-edit-item');
    syncTypeSelectByUrl(item);
  }, true);

  document.addEventListener('change', function (e) {
    const input = e.target.closest && e.target.closest('.se-url');
    if (!input) return;
    const item = input.closest('.stream-edit-item');
    syncTypeSelectByUrl(item);
  }, true);

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
        msgEl.textContent = '已保存（' + (data.type === 'flv' ? 'FLV' : 'HLS/m3u8') + '）';
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
