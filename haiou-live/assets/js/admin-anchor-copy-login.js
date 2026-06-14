/**
 * 管理后台：复制主播信息时自动追加主播后台登录地址。
 */

let bound = false;

function copyText(text) {
  navigator.clipboard.writeText(text).then(function () {
    alert('已复制，可以直接发给主播。');
  }).catch(function () {
    window.prompt('复制下面内容发给主播：', text);
  });
}

export function initAdminAnchorCopyLogin() {
  if (bound || document.body.dataset.page !== 'admin') return;
  bound = true;

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('[data-anchor-copy-all]');
    if (!btn) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const roomId = btn.dataset.anchorCopyAll;
    const card = document.querySelector('.admin-anchor-panel-card[data-anchor-room-id="' + roomId + '"]');
    if (!card) return;

    const username = (card.querySelector('.anchor-username') || {}).textContent || '';
    const password = (card.querySelector('.anchor-generated-password') || {}).textContent || '';
    const obsServer = (card.querySelector('.anchor-obs-server') || {}).value || '';
    const obsKey = (card.querySelector('.anchor-obs-key') || {}).value || '';

    if (!password) {
      alert('当前密码不可查看。请先点击“重置主播密码”，生成新密码后再复制给主播。');
      return;
    }
    if (!obsServer || !obsKey) {
      alert('请先填写并保存 OBS 服务器和 OBS 推流码。');
      return;
    }

    const loginUrl = location.origin + '/pages/anchor.html';
    const text = [
      '主播后台登录地址：' + loginUrl,
      '主播后台账号：' + username,
      '主播后台密码：' + password,
      'OBS 服务器：' + obsServer,
      'OBS 推流码：' + obsKey
    ].join('\n');

    copyText(text);
  }, true);
}
