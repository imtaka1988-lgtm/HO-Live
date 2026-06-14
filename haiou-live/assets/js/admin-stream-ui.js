/**
 * 后台播放源管理增强
 * 只增强展示：默认源 / 备用源 / HLS / FLV / 启用状态。
 */

function readValue(item, selector) {
  const el = item.querySelector(selector);
  return el ? String(el.value || '').trim() : '';
}

function readChecked(item, selector) {
  const el = item.querySelector(selector);
  return !!(el && el.checked);
}

function sourceHost(url) {
  if (!url) return '播放地址未填写';
  try {
    return new URL(url, location.origin).host || url;
  } catch (e) {
    return url.length > 46 ? url.slice(0, 46) + '...' : url;
  }
}

function badge(text, className) {
  const el = document.createElement('span');
  el.className = 'admin-stream-badge ' + className;
  el.textContent = text;
  return el;
}

function ensureSummary(item) {
  let summary = item.querySelector(':scope > .admin-stream-summary');
  if (summary) return summary;

  summary = document.createElement('div');
  summary.className = 'admin-stream-summary';
  item.insertBefore(summary, item.firstChild);
  return summary;
}

function updateStreamItem(item) {
  const name = readValue(item, '.se-name') || '未命名线路';
  const type = readValue(item, '.se-type') || 'hls';
  const url = readValue(item, '.se-url');
  const enabled = readChecked(item, '.se-enabled');
  const isDefault = readChecked(item, '.se-is-default');

  const summary = ensureSummary(item);
  summary.innerHTML = '';

  const main = document.createElement('div');
  main.className = 'admin-stream-main';

  const title = document.createElement('div');
  title.className = 'admin-stream-title';
  title.textContent = name;

  const sub = document.createElement('div');
  sub.className = 'admin-stream-sub';
  sub.textContent = sourceHost(url);

  main.appendChild(title);
  main.appendChild(sub);

  const badges = document.createElement('div');
  badges.className = 'admin-stream-badges';
  badges.appendChild(badge(type === 'flv' ? 'FLV' : 'HLS/m3u8', type === 'flv' ? 'is-flv' : 'is-hls'));
  badges.appendChild(badge(isDefault ? '默认源' : '备用源', isDefault ? 'is-default' : 'is-backup'));
  badges.appendChild(badge(enabled ? '启用中' : '已停用', enabled ? 'is-enabled' : 'is-disabled'));

  summary.appendChild(main);
  summary.appendChild(badges);
}

function bindStreamItem(item) {
  if (item.dataset.streamUiBound === '1') return;
  item.dataset.streamUiBound = '1';

  item.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', () => updateStreamItem(item));
    el.addEventListener('change', () => updateStreamItem(item));
  });
}

function ensureHelp() {
  const editor = document.querySelector('#streamEditor');
  if (!editor || editor.style.display === 'none') return;
  if (editor.querySelector('.admin-stream-help')) return;

  const title = editor.querySelector('h3');
  const help = document.createElement('div');
  help.className = 'admin-stream-help';
  help.textContent = '播放源支持任何云直播或 CDN 地址：HLS/m3u8 适合手机和通用播放，FLV 适合电脑低延迟。后台只区分默认源、备用源、启用状态，不绑定具体云厂商。';

  if (title) {
    title.insertAdjacentElement('afterend', help);
  } else {
    editor.insertBefore(help, editor.firstChild);
  }
}

function enhance() {
  if (document.body.dataset.page !== 'admin') return;
  ensureHelp();
  document.querySelectorAll('.stream-edit-item').forEach(item => {
    bindStreamItem(item);
    updateStreamItem(item);
  });
}

export function initAdminStreamUi() {
  if (document.body.dataset.page !== 'admin') return;

  enhance();

  const app = document.querySelector('#app');
  if (!app) return;

  const observer = new MutationObserver(enhance);
  observer.observe(app, { childList: true, subtree: true });
}
