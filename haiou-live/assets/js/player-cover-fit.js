/**
 * 播放器封面背景自适应
 * - 封面背景使用 cover 填满播放器区域
 * - 视频本体继续 contain，避免比赛画面被强行拉变形
 */

function safeCssUrl(url) {
  return String(url || '').replace(/"/g, '\\"');
}

function applyPlayerCoverFit() {
  if (document.body.dataset.page !== 'room') return;

  const box = document.querySelector('#videoBox');
  const video = document.querySelector('#liveVideo');
  if (!box || !video) return;

  const poster = video.getAttribute('poster') || '';
  if (!poster || poster === 'undefined' || poster === 'null') return;

  box.style.setProperty('--player-cover-bg', 'url("' + safeCssUrl(poster) + '")');
  box.classList.add('has-cover-bg');
}

export function initPlayerCoverFit() {
  if (document.body.dataset.page !== 'room') return;

  requestAnimationFrame(applyPlayerCoverFit);
  setTimeout(applyPlayerCoverFit, 120);
}
