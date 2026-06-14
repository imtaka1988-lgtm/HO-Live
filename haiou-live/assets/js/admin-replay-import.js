function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function normalizeCover(url) {
  url = String(url || '').trim();
  if (url.startsWith('http://')) return 'https://' + url.slice(7);
  return url;
}

function guessSport(title) {
  const s = String(title || '').toLowerCase();
  if (s.includes('nba') || s.includes('火箭') || s.includes('马刺') || s.includes('篮球')) return 'basketball';
  return 'football';
}

function guessTag(title, sport) {
  const s = String(title || '').toLowerCase();
  if (s.includes('nba')) return 'NBA';
  if (s.includes('世界杯')) return '世界杯';
  if (s.includes('欧冠')) return '欧冠';
  return sport === 'basketball' ? '篮球' : '足球';
}

function guessYear(title) {
  const m = String(title || '').match(/(19|20)\d{2}/);
  return m ? m[0] : '经典';
}

function buildReplayObject(meta) {
  const title = document.querySelector('#replayMetaTitle')?.value.trim() || meta.title || '';
  const sport = document.querySelector('#replayMetaSport')?.value || guessSport(title);
  const tag = document.querySelector('#replayMetaTag')?.value.trim() || guessTag(title, sport);
  const year = document.querySelector('#replayMetaYear')?.value.trim() || guessYear(title);
  const desc = document.querySelector('#replayMetaDesc')?.value.trim() || title;
  const sort = parseInt(document.querySelector('#replayMetaSort')?.value || '0', 10) || 0;

  return {
    id: Date.now(),
    title,
    sport,
    tag,
    year,
    cover: normalizeCover(meta.cover || ''),
    desc,
    url: meta.pageUrl || '',
    sourceType: 'bilibili',
    platform: 'bilibili',
    embedUrl: meta.embedUrl || '',
    status: '观看回顾',
    sort
  };
}

function renderResult(meta) {
  const title = meta.title || '';
  const cover = normalizeCover(meta.cover || '');
  const sport = guessSport(title);
  const tag = guessTag(title, sport);
  const year = guessYear(title);
  const desc = meta.desc || title;

  return `<div class="admin-replay-result-inner">
    <div class="admin-replay-cover-preview">
      ${cover ? `<img referrerpolicy="no-referrer" src="${escapeHtml(cover)}" alt="封面预览">` : '<span>未抓到封面</span>'}
    </div>
    <div class="admin-replay-fields">
      <label>标题<input id="replayMetaTitle" value="${escapeHtml(title)}"></label>
      <div class="admin-replay-two">
        <label>分类<select id="replayMetaSport"><option value="football" ${sport === 'football' ? 'selected' : ''}>足球</option><option value="basketball" ${sport === 'basketball' ? 'selected' : ''}>篮球</option></select></label>
        <label>标签<input id="replayMetaTag" value="${escapeHtml(tag)}"></label>
        <label>年份<input id="replayMetaYear" value="${escapeHtml(year)}"></label>
        <label>排序<input id="replayMetaSort" type="number" value="0"></label>
      </div>
      <label>简介<input id="replayMetaDesc" value="${escapeHtml(desc)}"></label>
      <label>播放地址<input readonly value="${escapeHtml(meta.embedUrl || '')}"></label>
      <div class="admin-replay-actions">
        <button id="btnCopyReplayJson" type="button">复制回放配置</button>
        <span id="replayCopyMsg"></span>
      </div>
      <textarea id="replayJsonOutput" readonly></textarea>
    </div>
  </div>`;
}

function bindResultCopy(meta) {
  const btn = document.querySelector('#btnCopyReplayJson');
  const out = document.querySelector('#replayJsonOutput');
  const msg = document.querySelector('#replayCopyMsg');
  if (!btn || !out) return;

  const refreshJson = function () {
    out.value = JSON.stringify(buildReplayObject(meta), null, 2);
  };

  document.querySelectorAll('#replayMetaTitle,#replayMetaSport,#replayMetaTag,#replayMetaYear,#replayMetaDesc,#replayMetaSort')
    .forEach(el => el.addEventListener('input', refreshJson));

  refreshJson();

  btn.addEventListener('click', async function () {
    refreshJson();
    try {
      await navigator.clipboard.writeText(out.value);
      if (msg) msg.textContent = '已复制';
    } catch (e) {
      out.select();
      document.execCommand('copy');
      if (msg) msg.textContent = '已复制';
    }
    setTimeout(function () { if (msg) msg.textContent = ''; }, 2200);
  });
}

async function fetchBilibiliMeta(url, token) {
  const res = await fetch('/api/admin/replay-meta/bilibili', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ url })
  });
  return await res.json();
}

export function initAdminReplayImport() {
  if (document.body.dataset.page !== 'admin') return;
  const token = localStorage.getItem('admin_token');
  if (!token) return;
  if (document.querySelector('#adminReplayImportCard')) return;

  const adminBox = document.querySelector('.admin-box');
  if (!adminBox) return;

  const card = document.createElement('div');
  card.className = 'admin-card admin-replay-import-card';
  card.id = 'adminReplayImportCard';
  card.innerHTML = `<div class="admin-replay-import-head">
    <div><h2>赛事回放导入</h2><p>粘贴 B站视频链接，自动识别标题、封面和播放地址。</p></div>
  </div>
  <div class="admin-replay-import-row">
    <input id="biliReplayUrl" placeholder="粘贴 B站链接，例如：https://www.bilibili.com/video/BVxxxx/">
    <button id="btnFetchBiliReplay" type="button">自动识别</button>
  </div>
  <p id="replayImportMsg" class="admin-replay-import-msg"></p>
  <div id="replayImportResult" class="admin-replay-import-result" style="display:none;"></div>`;

  const cards = adminBox.querySelectorAll('.admin-card');
  if (cards[1]) cards[1].insertAdjacentElement('afterend', card);
  else adminBox.appendChild(card);

  const btn = card.querySelector('#btnFetchBiliReplay');
  const input = card.querySelector('#biliReplayUrl');
  const msg = card.querySelector('#replayImportMsg');
  const resultBox = card.querySelector('#replayImportResult');

  btn.addEventListener('click', async function () {
    const url = input.value.trim();
    if (!url) {
      msg.textContent = '请先粘贴 B站链接';
      msg.style.color = 'var(--danger)';
      return;
    }

    btn.disabled = true;
    btn.textContent = '识别中...';
    msg.textContent = '正在识别 B站视频信息...';
    msg.style.color = '#6b7280';
    resultBox.style.display = 'none';
    resultBox.innerHTML = '';

    try {
      const data = await fetchBilibiliMeta(url, token);
      if (!data || !data.ok) throw new Error((data && data.error) ? data.error : '识别失败');
      msg.textContent = '识别成功，确认后可复制配置。';
      msg.style.color = 'var(--success)';
      resultBox.style.display = 'block';
      resultBox.innerHTML = renderResult(data);
      bindResultCopy(data);
    } catch (e) {
      msg.textContent = '识别失败：' + (e.message || '未知错误');
      msg.style.color = 'var(--danger)';
    } finally {
      btn.disabled = false;
      btn.textContent = '自动识别';
    }
  });
}
