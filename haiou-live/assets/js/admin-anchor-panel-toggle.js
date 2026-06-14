/**
 * 管理后台：主播后台面板再次点击同一按钮时收起。
 */

let bound = false;

function openedAnchorRow(roomId) {
  return Array.from(document.querySelectorAll('.admin-anchor-bundle-row')).find(function (row) {
    const prev = row.previousElementSibling;
    return prev && prev.dataset && String(prev.dataset.roomId) === String(roomId);
  });
}

export function initAdminAnchorPanelToggle() {
  if (bound || document.body.dataset.page !== 'admin') return;
  bound = true;

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.btn-anchor-bundle');
    if (!btn) return;

    const row = openedAnchorRow(btn.dataset.roomId);
    if (!row) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    row.remove();
  }, true);
}
