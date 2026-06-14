/**
 * 手机直播间输入法聚焦布局保护
 * 使用事件委托，避免输入框状态变化后丢失 focus 监听。
 */

let bound = false;
let blurTimer = null;

function isRoomChatInput(target) {
  return !!(target && target.matches && target.matches('body[data-page="room"] .mobile-chat-input input'));
}

function updateRoomVh() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (h) document.documentElement.style.setProperty('--room-vh', h + 'px');
}

function openChatFocus() {
  clearTimeout(blurTimer);
  updateRoomVh();
  document.body.classList.add('mobile-chat-focus');
  setTimeout(updateRoomVh, 80);
  setTimeout(updateRoomVh, 220);
}

function closeChatFocus() {
  clearTimeout(blurTimer);
  blurTimer = setTimeout(function () {
    if (isRoomChatInput(document.activeElement)) return;
    document.body.classList.remove('mobile-chat-focus');
    updateRoomVh();
  }, 180);
}

export function initMobileChatFocusFix() {
  if (bound) return;
  bound = true;

  document.addEventListener('focusin', function (e) {
    if (isRoomChatInput(e.target)) openChatFocus();
  }, true);

  document.addEventListener('focusout', function (e) {
    if (isRoomChatInput(e.target)) closeChatFocus();
  }, true);

  document.addEventListener('touchstart', function (e) {
    if (isRoomChatInput(e.target)) openChatFocus();
  }, { passive: true, capture: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      if (document.body.classList.contains('mobile-chat-focus')) updateRoomVh();
    }, { passive: true });
  }
}
