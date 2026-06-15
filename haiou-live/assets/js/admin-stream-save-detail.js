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

function ensureTestPanel(item) {
  let panel = item.querySelector('.admin-stream-test-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'admin-stream-test-panel';
    panel.style.cssText = 'margin-top:10px;border:1px solid #e5e7eb;border-radius:12px;background:#111827;padding:10px;max-width:720px;';
    panel.innerHTML = '<video class="admin-stream-test-video" controls playsinline muted style="width:100%;max-height:360px;background:#000;border-radius:8px;"></video><div class="admin-stream-test-status" style="margin-top:8px;color:#e5e7eb;font-size:12px;"></div>';
    item.appendChild(panel);
  }
  panel.style.display = 'block';
  return panel;
}

function setTestStatus(panel, text, color) {
  const status = panel && panel.querySelector('.admin-stream-test-status');
  if (!status) return;
  status.textContent = text || '';
  status.style.color = color || '#e5e7eb';
}

function stopOldTest(item) {
  const video = item && item.querySelector('.admin-stream-test-video');
  if (item && item.__adminTestHls) {
    try { item.__adminTestHls.detachMedia(); } catch (e) {}
    try { item.__adminTestHls.destroy(); } catch (e) {}
    item.__adminTestHls = null;
  }
  if (item && item.__adminTestFlv) {
    try { item.__adminTestFlv.pause(); } catch (e) {}
    try { item.__adminTestFlv.unload(); } catch (e) {}
    try { item.__adminTestFlv.detachMediaElement(); } catch (e) {}
    try { item.__adminTestFlv.destroy(); } catch (e) {}
    item.__adminTestFlv = null;
  }
  if (video) {
    try { video.pause(); } catch (e) {}
    try { video.removeAttribute('src'); } catch (e) {}
    try { video.srcObject = null; } catch (e) {}
    try { video.load(); } catch (e) {}
  }
}

function playHlsTest(item, video, url, panel) {
  const Hls = window.Hls;
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.play().then(function () {
      setTestStatus(panel, 'HLS/m3u8 测试播放成功', '#86efac');
    }).catch(function (err) {
      setTestStatus(panel, 'HLS 播放失败：' + (err && err.message ? err.message : '浏览器拒绝播放'), '#fecaca');
    });
    return;
  }

  if (!Hls || !Hls.isSupported || !Hls.isSupported()) {
    setTestStatus(panel, '当前浏览器不支持 HLS.js 测试播放', '#fecaca');
    return;
  }

  const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 60 });
  item.__adminTestHls = hls;
  hls.attachMedia(video);
  hls.on(Hls.Events.MEDIA_ATTACHED, function () { hls.loadSource(url); });
  hls.on(Hls.Events.MANIFEST_PARSED, function () {
    video.play().then(function () {
      setTestStatus(panel, 'HLS/m3u8 测试播放成功', '#86efac');
    }).catch(function () {
      setTestStatus(panel, 'HLS 已加载，但浏览器阻止自动播放，请手动点播放键', '#fde68a');
    });
  });
  hls.on(Hls.Events.ERROR, function (event, data) {
    if (!data || !data.fatal) return;
    setTestStatus(panel, 'HLS 测试失败：' + (data.details || data.type || '未知错误'), '#fecaca');
  });
}

function playFlvTest(item, video, url, panel) {
  const Flv = window.flvjs;
  if (!Flv || !Flv.isSupported || !Flv.isSupported()) {
    setTestStatus(panel, '当前浏览器不支持 FLV.js。PC Chrome/Edge 或安卓 Chrome 才适合测试 FLV。', '#fecaca');
    return;
  }

  try {
    const flv = Flv.createPlayer({
      type: 'flv',
      url: url,
      isLive: true,
      cors: true
    }, {
      enableWorker: false,
      lazyLoad: false,
      stashInitialSize: 128
    });
    item.__adminTestFlv = flv;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    flv.attachMediaElement(video);
    flv.load();
    video.play().then(function () {
      setTestStatus(panel, 'FLV 测试播放成功', '#86efac');
    }).catch(function () {
      setTestStatus(panel, 'FLV 已加载，但浏览器阻止自动播放，请手动点播放键', '#fde68a');
    });
    flv.on(Flv.Events.ERROR, function (type, detail, info) {
      const msg = detail || type || '未知错误';
      const hint = /network|cors|exception|http/i.test(String(msg)) ? '，请检查 FLV 源是否允许跨域 CORS、是否 403/404、是否 HTTPS' : '';
      setTestStatus(panel, 'FLV 测试失败：' + msg + hint, '#fecaca');
      console.warn('[Admin FLV Test]', type, detail, info);
    });
  } catch (e) {
    setTestStatus(panel, 'FLV 初始化失败：' + (e && e.message ? e.message : '未知错误'), '#fecaca');
  }
}

function bindTypeAutoSync() {
  document.addEventListener('input', function (e) {
    const input = e.target.closest && e.target.closest('.se-url');
    if (!input) return;
    syncTypeSelectByUrl(input.closest('.stream-edit-item'));
  }, true);

  document.addEventListener('change', function (e) {
    const input = e.target.closest && e.target.closest('.se-url');
    if (!input) return;
    syncTypeSelectByUrl(input.closest('.stream-edit-item'));
  }, true);
}

function bindStreamSave() {
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

function bindStreamTest() {
  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.btn-stream-test');
    if (!btn) return;
    const item = btn.closest('.stream-edit-item');
    if (!item) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const urlInput = item.querySelector('.se-url');
    const typeSelect = item.querySelector('.se-type');
    const url = urlInput ? String(urlInput.value || '').trim() : '';
    const type = inferTypeFromUrl(url, typeSelect && typeSelect.value);

    if (!url) {
      alert('请先填写播放地址');
      return;
    }

    if (typeSelect && typeSelect.value !== type) typeSelect.value = type;

    const panel = ensureTestPanel(item);
    const video = panel.querySelector('.admin-stream-test-video');
    stopOldTest(item);
    setTestStatus(panel, '正在测试 ' + (type === 'flv' ? 'FLV' : 'HLS/m3u8') + ' 播放源...', '#e5e7eb');

    if (type === 'flv') playFlvTest(item, video, url, panel);
    else playHlsTest(item, video, url, panel);
  }, true);
}

export function initAdminStreamSaveDetail() {
  if (document.body.dataset.page !== 'admin') return;
  if (window.__adminStreamToolsInstalled) return;
  window.__adminStreamToolsInstalled = true;

  bindTypeAutoSync();
  bindStreamSave();
  bindStreamTest();
}
