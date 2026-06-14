/**
 * 后台播放源文案修正
 * - HLS/m3u8 保持短文案
 * - FLV 已启用，不再显示“后续启用”
 */

function patchStreamTypeLabels(root = document) {
  root.querySelectorAll('.se-type option').forEach(option => {
    if (option.value === 'hls') option.textContent = 'HLS/m3u8';
    if (option.value === 'flv') option.textContent = 'FLV';
  });

  root.querySelectorAll('.se-type').forEach(select => {
    select.title = select.value === 'flv' ? 'FLV 低延迟播放' : 'HLS/m3u8 网页通用播放';
  });
}

function schedulePatch() {
  let attempts = 0;

  const tick = () => {
    patchStreamTypeLabels();
    attempts += 1;
    if (attempts < 12) setTimeout(tick, 80);
  };

  setTimeout(tick, 30);
}

export function initAdminStreamLabels() {
  if (document.body.dataset.page !== 'admin') return;

  patchStreamTypeLabels();

  document.addEventListener('click', function (e) {
    if (e.target.closest('.btn-stream-mgr, .btn-stream-add, .btn-stream-save, .btn-stream-delete')) {
      schedulePatch();
    }
  }, true);
}
