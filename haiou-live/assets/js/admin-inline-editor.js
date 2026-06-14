/**
 * 后台房间编辑面板：跟随对应房间行展开。
 * 不改保存、删除、测试播放等业务逻辑，只移动编辑面板显示位置。
 */

function tableCard() {
  const tableBox = document.querySelector('#roomTableContainer');
  return tableBox ? tableBox.closest('.admin-card') : null;
}

function ensureEditor(id) {
  let editor = document.querySelector(id);
  if (editor) return editor;

  const card = tableCard();
  if (!card) return null;

  editor = document.createElement('div');
  editor.id = id.replace('#', '');
  editor.style.display = 'none';
  card.appendChild(editor);
  return editor;
}

function ensureEditors() {
  ensureEditor('#roomEditor');
  ensureEditor('#streamEditor');
}

function removeInlineRows() {
  document.querySelectorAll('.admin-inline-editor-row').forEach(row => row.remove());
}

function moveEditorBelowRoom(roomId, editorSelector) {
  const row = document.querySelector('tr[data-room-id="' + roomId + '"]');
  const editor = document.querySelector(editorSelector);

  if (!row || !editor || !editor.innerHTML.trim() || editor.style.display === 'none') {
    return false;
  }

  removeInlineRows();

  const inlineRow = document.createElement('tr');
  inlineRow.className = 'admin-inline-editor-row';
  inlineRow.dataset.roomId = roomId;

  const cell = document.createElement('td');
  cell.colSpan = 7;

  const shell = document.createElement('div');
  shell.className = 'admin-inline-editor-shell';

  cell.appendChild(shell);
  inlineRow.appendChild(cell);
  row.insertAdjacentElement('afterend', inlineRow);

  editor.classList.add('admin-inline-editor-panel');
  editor.style.display = 'block';
  shell.appendChild(editor);

  inlineRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return true;
}

function scheduleMove(roomId, editorSelector) {
  let attempts = 0;

  const tick = function () {
    if (moveEditorBelowRoom(roomId, editorSelector)) return;
    attempts += 1;
    if (attempts < 30) setTimeout(tick, 80);
  };

  setTimeout(tick, 80);
}

export function initAdminInlineEditors() {
  if (document.body.dataset.page !== 'admin') return;
  if (window.__adminInlineEditorsBound) return;
  window.__adminInlineEditorsBound = true;

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-room-edit, .btn-stream-mgr, .btn-room-delete');
    if (!btn) return;

    if (btn.classList.contains('btn-room-delete')) {
      removeInlineRows();
      return;
    }

    ensureEditors();

    const roomId = btn.dataset.roomId;
    if (!roomId) return;

    const editorSelector = btn.classList.contains('btn-stream-mgr') ? '#streamEditor' : '#roomEditor';
    scheduleMove(roomId, editorSelector);
  }, true);
}
