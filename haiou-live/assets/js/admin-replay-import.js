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

function hasAny(text, words) {
  return words.some(function (word) { return text.includes(word); });
}

function guessSport(title) {
  const s = String(title || '').toLowerCase();
  const basketballWords = ['nba', 'cba', 'wnba', '篮球', '籃球', '男篮', '女篮', '火箭', '马刺', '馬刺', '湖人', '勇士', '凯尔特人', '凱爾特人', '公牛', '热火', '熱火', '独行侠', '獨行俠', '快船', '太阳', '太陽', '掘金', '雄鹿', '篮网', '籃網'];
  const footballWords = ['世界杯', 'world cup', 'fifa', '足球', '欧冠', '歐冠', '英超', '西甲', '意甲', '德甲', '法甲', '中超', '亚冠', '亞冠', '欧洲杯', '歐洲杯', '美洲杯', '国足', '國足'];
  if (hasAny(s, basketballWords)) return 'basketball';
  if (hasAny(s, footballWords)) return 'football';
  return 'football';
}

function guessTag(title, sport) {
  const s = String(title || '').toLowerCase();
  if (s.includes('世界杯') || s.includes('world cup') || s.includes('fifa')) return '世界杯';
  if (s.includes('nba')) return 'NBA';
  if (s.includes('欧冠') || s.includes('歐冠')) return '欧冠';
  if (s.includes('欧洲杯') || s.includes('歐洲杯')) return '欧洲杯';
  if (s.includes('英超')) return '英超';
  if (s.includes('西甲')) return '西甲';
  if (s.includes('cba')) return 'CBA';
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
        <button id="btnSaveReplayJson" type="button">保存到回放列表</button>
        <button id="btnCopyReplayJson" type="button">复制配置</button>
        <span id="replayCopyMsg"></span>
      </div>
      <textarea id="replayJsonOutput" readonly></textarea>
    </div>
  </div>`;
}

async function saveReplayToServer(replay, token) {
  const res = await fetch('/api/admin/replays', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(replay)
  });
  return await res.json();
}

async function fetchSavedReplays(token) {
  const res = await fetch('/api/admin/replays', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return await res.json();
}

async function deleteSavedReplay(id, token) {
  const res = await fetch('/api/admin/replays/' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return await res.json();
}

function renderSavedReplayList(items) {
  if (!items || !items.length) {
    return '<div style="color:#999;font-size:13px;padding:10px 0;">暂无后台保存的回放</div>';
  }

  return items.map(function (item) {
    return `<div class="admin-saved-replay-item" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #f1f1f1;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.title || '未命名回放')}</div>
        <div style="font-size:12px;color:#888;margin-top:3px;">${escapeHtml(item.tag || '')} / ${escapeHtml(item.year || '')}</div>
      </div>
      <a href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener" style="font-size:12px;color:#2563eb;white-space:nowrap;">打开</a>
      <button class="btn-delete-saved-replay" data-replay-id="${escapeHtml(item.id)}" type="button" style="padding:6px 12px;background:#fee2e2;color:#b91c1c;border:0;border-radius:999px;font-weight:800;">删除</button>
    </div>`;
  }).join('');
}

async function loadSavedReplayList(token) {
  const box = document.querySelector('#savedReplayList');
  if (!box) return;
  box.innerHTML = '<div style="color:#999;font-size:13px;padding:10px 0;">加载已保存回放...</div>';
  try {
    const data = await fetchSavedReplays(token);
    if (!data || !data.ok) throw new Error('加载失败');
    box.innerHTML = renderSavedReplayList(data.replays || []);
    box.querySelectorAll('.btn-delete-saved-replay').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const id = this.dataset.replayId;
        if (!confirm('确定删除这个回放卡片吗？删除后前台将不再显示。')) return;
        this.disabled = true;
        this.textContent = '删除中...';
        const result = await deleteSavedReplay(id, token);
        if (!result || !result.ok) {
          alert('删除失败：' + ((result && result.error) ? result.error : '未知错误'));
          this.disabled = false;
          this.textContent = '删除';
          return;
        }
        await loadSavedReplayList(token);
      });
    });
  } catch (e) {
    box.innerHTML = '<div style="color:var(--danger);font-size:13px;padding:10px 0;">已保存回放加载失败</div>';
  }
}

async function showSavedReplayList(token) {
  const wrap = document.querySelector('#savedReplayListWrap');
  const toggle = document.querySelector('#btnToggleSavedReplays');
  if (wrap) wrap.style.display = 'block';
  if (toggle) toggle.textContent = '收起已保存回放 ▾';
  await loadSavedReplayList(token);
}

function bindResultActions(meta, token) {
  const copyBtn = document.querySelector('#btnCopyReplayJson');
  const saveBtn = document.querySelector('#btnSaveReplayJson');
  const out = document.querySelector('#replayJsonOutput');
  const msg = document.querySelector('#replayCopyMsg');
  if (!out) return;

  const refreshJson = function () {
    out.value = JSON.stringify(buildReplayObject(meta), null, 2);
  };

  document.querySelectorAll('#replayMetaTitle,#replayMetaSport,#replayMetaTag,#replayMetaYear,#replayMetaDesc,#replayMetaSort')
    .forEach(function (el) { el.addEventListener('input', refreshJson); el.addEventListener('change', refreshJson); });

  refreshJson();

  if (copyBtn) {
    copyBtn.addEventListener('click', async function () {
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

  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      refreshJson();
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
      if (msg) {
        msg.textContent = '正在保存...';
        msg.style.color = '#6b7280';
      }
      try {
        const result = await saveReplayToServer(buildReplayObject(meta), token);
        if (!result || !result.ok) throw new Error((result && result.error) ? result.error : '保存失败');
        if (msg) {
          msg.textContent = result.action === 'updated' ? '已更新到回放列表' : '已保存到回放列表';
          msg.style.color = 'var(--success)';
        }
        await showSavedReplayList(token);
      } catch (e) {
        if (msg) {
          msg.textContent = '保存失败：' + (e.message || '未知错误');
          msg.style.color = 'var(--danger)';
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存到回放列表';
      }
    });
  }
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
    <div><h2>赛事回放导入</h2><p>粘贴 B站视频链接，自动识别标题、封面、分类和播放地址。</p></div>
  </div>
  <div class="admin-replay-import-row">
    <input id="biliReplayUrl" placeholder="粘贴 B站链接，例如：https://www.bilibili.com/video/BVxxxx/">
    <button id="btnFetchBiliReplay" type="button">自动识别</button>
  </div>
  <p id="replayImportMsg" class="admin-replay-import-msg"></p>
  <div id="replayImportResult" class="admin-replay-import-result" style="display:none;"></div>
  <div style="margin-top:16px;padding-top:14px;border-top:1px dashed #eadfd6;">
    <button id="btnToggleSavedReplays" type="button" style="padding:7px 14px;border:0;border-radius:999px;background:#eef2ff;color:#3730a3;font-weight:800;">展开已保存回放 ▸</button>
    <div id="savedReplayListWrap" style="display:none;margin-top:10px;">
      <div id="savedReplayList"></div>
    </div>
  </div>`;

  const cards = adminBox.querySelectorAll('.admin-card');
  if (cards[1]) cards[1].insertAdjacentElement('afterend', card);
  else adminBox.appendChild(card);

  const toggleSavedBtn = card.querySelector('#btnToggleSavedReplays');
  const savedWrap = card.querySelector('#savedReplayListWrap');
  if (toggleSavedBtn && savedWrap) {
    toggleSavedBtn.addEventListener('click', async function () {
      if (savedWrap.style.display === 'none' || !savedWrap.style.display) {
        await showSavedReplayList(token);
      } else {
        savedWrap.style.display = 'none';
        toggleSavedBtn.textContent = '展开已保存回放 ▸';
      }
    });
  }

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
      msg.textContent = '识别成功，已自动分类，可手动微调。';
      msg.style.color = 'var(--success)';
      resultBox.style.display = 'block';
      resultBox.innerHTML = renderResult(data);
      bindResultActions(data, token);
    } catch (e) {
      msg.textContent = '识别失败：' + (e.message || '未知错误');
      msg.style.color = 'var(--danger)';
    } finally {
      btn.disabled = false;
      btn.textContent = '自动识别';
    }
  });
}
