/**
 * 管理后台：主播后台面板再次点击同一按钮时收起，并清理残留孤立按钮。
 */

let bound = false;

function openedAnchorRow(roomId) {
  return document.querySelector('.admin-anchor-bundle-row[data-anchor-room-id="' + roomId + '"]') ||
    Array.from(document.querySelectorAll('.admin-anchor-bundle-row')).find(function (row) {
      const card = row.querySelector('.admin-anchor-panel-card[data-anchor-room-id]');
      if (card && String(card.dataset.anchorRoomId) === String(roomId)) return true;
      const prev = row.previousElementSibling;
      return prev && prev.dataset && String(prev.dataset.roomId) === String(roomId);
    });
}

function isRealRoomRow(row) {
  if (!row || !row.matches || !row.matches('#roomTableBody > tr[data-room-id]')) return false;
  if (row.classList.contains('admin-room-inline-editor-row')) return false;
  if (row.classList.contains('admin-anchor-bundle-row')) return false;
  return true;
}

function cleanupFloatingAnchorButtons() {
  document.querySelectorAll('#roomTableBody .btn-anchor-bundle').forEach(function (btn) {
    const row = btn.closest('tr');
    if (!isRealRoomRow(row)) btn.remove();
  });
}

export function initAdminAnchorPanelToggle() {
  if (bound || document.body.dataset.page !== 'admin') return;
  bound = true;

  cleanupFloatingAnchorButtons();
  setInterval(cleanupFloatingAnchorButtons, 1200);

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.btn-anchor-bundle');
    if (!btn) return;

    cleanupFloatingAnchorButtons();

    const row = openedAnchorRow(btn.dataset.roomId);
    if (!row) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    row.remove();
    cleanupFloatingAnchorButtons();
  }, true);
}
