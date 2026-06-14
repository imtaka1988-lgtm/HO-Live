/**
 * 后台房间编辑区跟随对应房间行展示
 */

function editorParking() {
  let box = document.querySelector('#adminEditorParking');
  if (!box) {
    box = document.createElement('div');
    box.id = 'adminEditorParking';
    box.style.display = 'none';
    document.body.appendChild(box);
  }
  return box;
}

function parkEditors() {
  const box = editorParking();
  ['roomEditor', 'streamEditor'].forEach(function (id) {
    const el = document.querySelector('#' + id);
    if (el) box.appendChild(el);
  });
}

function removeInlineEditorRows() {
  parkEditors();
  document.querySelectorAll('.admin-room-inline-editor-row').forEach(function (row) {
    row.remove();
  });
}

function isSameEditorOpen(editorId, roomId) {
  return !!document.querySelector('.admin-room-inline-editor-row[data-editor-id="' + editorId + '"][data-editor-room-id="' + roomId + '"]');
}

function closeInlineEditors() {
  removeInlineEditorRows();
  ['roomEditor', 'streamEditor'].forEach(function (id) {
    const el = document.querySelector('#' + id);
    if (el) el.style.display = 'none';
  });
}

function placeEditorUnderRoom(editorId, roomId) {
  const tbody = document.querySelector('#roomTableBody');
  const row = tbody ? tbody.querySelector('tr[data-room-id="' + roomId + '"]') : null;
  const editor = document.querySelector('#' + editorId);
  if (!tbody || !row || !editor) return;
  if (editor.style.display === 'none' || !editor.innerHTML.trim()) return;

  removeInlineEditorRows();

  const wrap = document.createElement('tr');
  wrap.className = 'admin-room-inline-editor-row';
  wrap.dataset.editorId = editorId;
  wrap.dataset.editorRoomId = String(roomId);
  wrap.innerHTML = '<td colspan="7" style="padding:0 8px 14px;background:#fff7ed;border-bottom:1px solid #fed7aa;"><div class="admin-room-inline-editor-cell" style="margin:8px 0 0;border:1px solid #fed7aa;border-radius:8px;background:#fff;padding:14px;"></div></td>';
  row.insertAdjacentElement('afterend', wrap);
  wrap.querySelector('.admin-room-inline-editor-cell').appendChild(editor);
  editor.style.display = 'block';
}

function schedulePlace(editorId, roomId) {
  [80, 220, 500].forEach(function (delay) {
    setTimeout(function () {
      placeEditorUnderRoom(editorId, roomId);
    }, delay);
  });
}

export function initAdminRoomInlineEditors() {
  if (document.body.dataset.page !== 'admin') return;

  document.addEventListener('click', function (e) {
    const roomBtn = e.target.closest && e.target.closest('.btn-room-edit');
    const streamBtn = e.target.closest && e.target.closest('.btn-stream-mgr');

    if (roomBtn) {
      if (isSameEditorOpen('roomEditor', roomBtn.dataset.roomId)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeInlineEditors();
        return;
      }
      schedulePlace('roomEditor', roomBtn.dataset.roomId);
      return;
    }

    if (streamBtn) {
      if (isSameEditorOpen('streamEditor', streamBtn.dataset.roomId)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeInlineEditors();
        return;
      }
      schedulePlace('streamEditor', streamBtn.dataset.roomId);
    }
  }, true);
}
