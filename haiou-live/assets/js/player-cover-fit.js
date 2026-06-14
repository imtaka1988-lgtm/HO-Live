/**
 * 播放器封面背景自适应
 * - 封面背景使用 cover 填满播放器区域
 * - 视频本体继续 contain，避免比赛画面被强行拉变形
 * - 移除 video poster 展示层，避免封面和背景双层重影
 */

function safeCssUrl(url) {
  return String(url || '').replace(/"/g, '\\"');
}

function applyPlayerCoverFit() {
  if (document.body.dataset.page !== 'room') return;

  const box = document.querySelector('#videoBox');
  const video = document.querySelector('#liveVideo');
  if (!box || !video) return;

  const poster = video.getAttribute('poster') || video.dataset.coverPoster || '';
  if (!poster || poster === 'undefined' || poster === 'null') return;

  box.style.setProperty('--player-cover-bg', 'url("' + safeCssUrl(poster) + '")');
  box.classList.add('has-cover-bg');

  // 背景层已经负责展示封面，video 自带 poster 会形成第二层重影，所以移除。
  video.dataset.coverPoster = poster;
  video.removeAttribute('poster');
}

export function initPlayerCoverFit() {
  if (document.body.dataset.page !== 'room') return;

  requestAnimationFrame(applyPlayerCoverFit);
  setTimeout(applyPlayerCoverFit, 120);
}
