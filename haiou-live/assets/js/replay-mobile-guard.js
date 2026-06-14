function isMobileReplayDevice() {
  const ua = navigator.userAgent || '';
  const isTouchIpad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isTouchIpad || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function closeReplayMobileTip() {
  const old = document.querySelector('#replayMobileTip');
  if (old) old.remove();
  document.body.classList.remove('replay-modal-open');
}

function showReplayMobileTip(title) {
  closeReplayMobileTip();
  document.body.classList.add('replay-modal-open');
  const modal = document.createElement('div');
  modal.id = 'replayMobileTip';
  modal.className = 'replay-modal-overlay';
  modal.innerHTML = `<div class="replay-modal-box replay-mobile-tip-box">
    <div class="replay-modal-head"><b>${title || '赛事回放'}</b><button type="button" data-close-mobile-tip>×</button></div>
    <div class="replay-mobile-tip-content">
      <div class="replay-mobile-tip-icon">!</div>
      <h3>手机端暂不支持播放</h3>
      <p>该回放在手机浏览器暂时无法稳定播放，请前往电脑端观看。</p>
      <button type="button" data-close-mobile-tip>我知道了</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', function (event) {
    if (event.target === modal || event.target.hasAttribute('data-close-mobile-tip')) closeReplayMobileTip();
  });
}

export function initReplayMobileGuard() {
  if (!isMobileReplayDevice()) return;
  document.addEventListener('click', function (event) {
    const card = event.target.closest && event.target.closest('.replay-card[data-source-type="bilibili"]');
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showReplayMobileTip(card.dataset.title || '赛事回放');
  }, true);
}
