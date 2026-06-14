/**
 * 后台房间列表按房间 ID 数字升序排列
 */

function roomIdFromRow(row) {
  const firstCell = row && row.children ? row.children[0] : null;
  const n = firstCell ? parseInt(firstCell.textContent.trim(), 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function sortRoomTableRows() {
  const tbody = document.querySelector('#roomTableBody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.querySelector('td'));
  if (rows.length < 2) return;

  const sorted = rows.slice().sort(function (a, b) {
    return roomIdFromRow(a) - roomIdFromRow(b);
  });

  let changed = false;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i] !== sorted[i]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;

  sorted.forEach(row => tbody.appendChild(row));
}

export function initAdminRoomSort() {
  if (document.body.dataset.page !== 'admin') return;

  let timer = null;
  const runSoon = function () {
    clearTimeout(timer);
    timer = setTimeout(sortRoomTableRows, 60);
  };

  runSoon();

  const observer = new MutationObserver(runSoon);
  const watch = function () {
    const tbody = document.querySelector('#roomTableBody');
    if (!tbody) {
      setTimeout(watch, 200);
      return;
    }
    observer.observe(tbody, { childList: true });
    runSoon();
  };
  watch();
}
