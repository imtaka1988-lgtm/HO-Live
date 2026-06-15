function urlPath(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, location.href).pathname.toLowerCase();
  } catch (e) {
    return raw.split('?')[0].split('#')[0].toLowerCase();
  }
}

function inferType(url, fallbackType) {
  const path = urlPath(url);
  if (/\.flv$/i.test(path)) return 'flv';
  if (/\.m3u8$/i.test(path)) return 'hls';
  return String(fallbackType || 'hls').toLowerCase() === 'flv' ? 'flv' : 'hls';
}

function ensurePanel(item) {
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

function setStatus(panel, text, color) {
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

function playHls(item, video, url, panel) {
  const Hls = window.Hls;
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.play().then(function () {
      setStatus(panel, 'HLS/m3u8 测试播放成功', '#86efac');
    }).catch(function (err) {
      setStatus(panel, 'HLS 播放失败：' + (err && err.message ? err.message : '浏览器拒绝播放'), '#fecaca');
    });
    return;
  }

  if (!Hls || !Hls.isSupported || !Hls.isSupported()) {
    setStatus(panel, '当前浏览器不支持 HLS.js 测试播放', '#fecaca');
    return;
  }

  const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 60 });
  item.__adminTestHls = hls;
  hls.attachMedia(video);
  hls.on(Hls.Events.MEDIA_ATTACHED, function () {
    hls.loadSource(url);
  });
  hls.on(Hls.Events.MANIFEST_PARSED, function () {
    video.play().then(function () {
      setStatus(panel, 'HLS/m3u8 测试播放成功', '#86efac');
    }).catch(function () {
      setStatus(panel, 'HLS 已加载，但浏览器阻止自动播放，请手动点播放键', '#fde68a');
    });
  });
  hls.on(Hls.Events.ERROR, function (event, data) {
    if (!data || !data.fatal) return;
    setStatus(panel, 'HLS 测试失败：' + (data.details || data.type || '未知错误'), '#fecaca');
  });
}

function playFlv(item, video, url, panel) {
  const Flv = window.flvjs;
  if (!Flv || !Flv.isSupported || !Flv.isSupported()) {
    setStatus(panel, '当前浏览器不支持 FLV.js。PC Chrome/Edge 或安卓 Chrome 才适合测试 FLV。', '#fecaca');
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
      setStatus(panel, 'FLV 测试播放成功', '#86efac');
    }).catch(function () {
      setStatus(panel, 'FLV 已加载，但浏览器阻止自动播放，请手动点播放键', '#fde68a');
    });
    flv.on(Flv.Events.ERROR, function (type, detail, info) {
      const msg = detail || type || '未知错误';
      const hint = /network|cors|exception|http/i.test(String(msg)) ? '，请检查 FLV 源是否允许跨域 CORS、是否 403/404、是否 HTTPS' : '';
      setStatus(panel, 'FLV 测试失败：' + msg + hint, '#fecaca');
      console.warn('[Admin FLV Test]', type, detail, info);
    });
  } catch (e) {
    setStatus(panel, 'FLV 初始化失败：' + (e && e.message ? e.message : '未知错误'), '#fecaca');
  }
}

function bindAdminStreamTestPlayer() {
  if (document.body.dataset.page !== 'admin') return;
  if (window.__adminStreamTestPlayerInstalled) return;
  window.__adminStreamTestPlayerInstalled = true;

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.btn-stream-test');
    if (!btn) return;
    const item = btn.closest('.stream-edit-item');
    if (!item) return;
    const urlInput = item.querySelector('.se-url');
    const typeSelect = item.querySelector('.se-type');
    const url = urlInput ? String(urlInput.value || '').trim() : '';
    const type = inferType(url, typeSelect && typeSelect.value);

    e.preventDefault();
    e.stopImmediatePropagation();

    if (!url) {
      alert('请先填写播放地址');
      return;
    }

    if (typeSelect && typeSelect.value !== type) typeSelect.value = type;

    const panel = ensurePanel(item);
    const video = panel.querySelector('.admin-stream-test-video');
    stopOldTest(item);
    setStatus(panel, '正在测试 ' + (type === 'flv' ? 'FLV' : 'HLS/m3u8') + ' 播放源...', '#e5e7eb');

    if (type === 'flv') playFlv(item, video, url, panel);
    else playHls(item, video, url, panel);
  }, true);
}

bindAdminStreamTestPlayer();
