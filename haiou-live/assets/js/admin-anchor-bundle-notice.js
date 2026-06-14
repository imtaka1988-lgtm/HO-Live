/**
 * 管理后台新增房间后，展示自动生成的主播账号与 OBS 信息。
 * 使用 fetch clone 监听响应，不改原有后台创建房间逻辑。
 */

let bound = false;

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
  });
}

function injectStyle() {
  if (document.querySelector('#adminAnchorBundleNoticeStyle')) return;
  const style = document.createElement('style');
  style.id = 'adminAnchorBundleNoticeStyle';
  style.textContent = `
    .anchor-bundle-mask {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(15, 23, 42, .46);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }
    .anchor-bundle-card {
      width: min(720px, 100%);
      max-height: calc(100vh - 36px);
      overflow: auto;
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, .28);
      border: 1px solid #fed7aa;
    }
    .anchor-bundle-head {
      padding: 18px 20px;
      background: linear-gradient(135deg, #111827, #3b260b);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .anchor-bundle-head h3 {
      margin: 0 0 4px;
      font-size: 20px;
    }
    .anchor-bundle-head p {
      margin: 0;
      color: rgba(255,255,255,.72);
      font-size: 13px;
    }
    .anchor-bundle-close {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(255,255,255,.14);
      color: #fff;
      font-size: 22px;
      border: 0;
      cursor: pointer;
    }
    .anchor-bundle-body {
      padding: 18px 20px 20px;
    }
    .anchor-bundle-tip {
      margin: 0 0 14px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #fff7ed;
      color: #9a3412;
      font-size: 13px;
      line-height: 1.55;
      border: 1px solid #fed7aa;
    }
    .anchor-bundle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .anchor-bundle-item {
      padding: 12px;
      border-radius: 12px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
    }
    .anchor-bundle-item label {
      display: block;
      color: #6b7280;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .anchor-bundle-value {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .anchor-bundle-value code {
      flex: 1;
      min-width: 0;
      padding: 7px 8px;
      border-radius: 8px;
      background: #111827;
      color: #fde68a;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .anchor-bundle-copy {
      flex: 0 0 auto;
      height: 30px;
      padding: 0 10px;
      border-radius: 8px;
      background: #f97316;
      color: #fff;
      border: 0;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
    }
    .anchor-bundle-footer {
      margin-top: 14px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .anchor-bundle-ok {
      height: 38px;
      padding: 0 18px;
      border-radius: 999px;
      background: #111827;
      color: #fff;
      border: 0;
      font-weight: 800;
      cursor: pointer;
    }
    @media (max-width: 767px) {
      .anchor-bundle-grid { grid-template-columns: 1fr; }
      .anchor-bundle-head { align-items: flex-start; }
    }
  `;
  document.head.appendChild(style);
}

function copyText(text, btn) {
  const value = String(text || '');
  if (!value) return;
  navigator.clipboard.writeText(value).then(function () {
    const old = btn.textContent;
    btn.textContent = '已复制';
    setTimeout(function () { btn.textContent = old; }, 1200);
  }).catch(function () {
    window.prompt('复制下面内容：', value);
  });
}

function row(label, value) {
  const safeValue = String(value || '未配置');
  const disabled = value ? '' : ' disabled';
  return `<div class="anchor-bundle-item">
    <label>${esc(label)}</label>
    <div class="anchor-bundle-value"><code title="${esc(safeValue)}">${esc(safeValue)}</code><button class="anchor-bundle-copy" data-copy="${esc(safeValue)}"${disabled}>复制</button></div>
  </div>`;
}

function showBundleNotice(data) {
  if (!data || !data.ok || !data.anchor) return;
  injectStyle();

  const room = data.room || {};
  const anchor = data.anchor || {};
  const stream = data.streamProfile || {};
  const playback = Array.isArray(data.playbackStreams) ? data.playbackStreams : [];
  const hls = stream.pullHlsUrl || ((playback.find(function (x) { return x.type === 'hls'; }) || {}).url || '');
  const obsServer = stream.obsServer || '';
  const obsKey = stream.obsStreamKey || stream.streamName || '';

  const old = document.querySelector('.anchor-bundle-mask');
  if (old) old.remove();

  const mask = document.createElement('div');
  mask.className = 'anchor-bundle-mask';
  mask.innerHTML = `<div class="anchor-bundle-card">
    <div class="anchor-bundle-head">
      <div><h3>主播后台已自动生成</h3><p>请保存账号密码，初始密码只在本次创建后展示。</p></div>
      <button class="anchor-bundle-close" type="button">×</button>
    </div>
    <div class="anchor-bundle-body">
      <p class="anchor-bundle-tip">房间 #${esc(room.id)} 已绑定主播账号。主播以后登录自己的后台，只能管理这个房间。</p>
      <div class="anchor-bundle-grid">
        ${row('房间 ID', room.id)}
        ${row('主播账号', anchor.username)}
        ${row('主播初始密码', anchor.password)}
        ${row('主播显示名', anchor.displayName)}
        ${row('OBS 服务器', obsServer)}
        ${row('OBS 推流码', obsKey)}
        ${row('推流名 streamName', stream.streamName)}
        ${row('HLS 播放地址', hls)}
      </div>
      <div class="anchor-bundle-footer"><button class="anchor-bundle-ok" type="button">我已保存</button></div>
    </div>
  </div>`;

  document.body.appendChild(mask);
  mask.addEventListener('click', function (e) {
    if (e.target === mask || e.target.classList.contains('anchor-bundle-close') || e.target.classList.contains('anchor-bundle-ok')) {
      mask.remove();
      return;
    }
    if (e.target.classList.contains('anchor-bundle-copy')) {
      copyText(e.target.dataset.copy, e.target);
    }
  });
}

function isCreateRoomRequest(input, init) {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
  return method === 'POST' && /\/api\/admin\/rooms(?:\?|$)/.test(url);
}

export function initAdminAnchorBundleNotice() {
  if (bound || document.body.dataset.page !== 'admin') return;
  bound = true;

  const rawFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const shouldWatch = isCreateRoomRequest(input, init);
    const res = await rawFetch(input, init);
    if (shouldWatch) {
      try {
        res.clone().json().then(showBundleNotice).catch(function () {});
      } catch (e) {}
    }
    return res;
  };
}
