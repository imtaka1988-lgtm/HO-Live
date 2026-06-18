/**
 * 手机直播间输入法聚焦布局保护
 * 轻量方案：只更新 visualViewport 高度和 focus class，不再给 body/app/video 写大量 inline style。
 */

let bound = false;
let blurTimer = null;
let layoutFrame = 0;
let forceResetUntil = 0;

function isRoomPage() {
  return document.body && document.body.dataset.page === 'room';
}

function isRoomChatInput(target) {
  return !!(target && target.matches && target.matches('body[data-page="room"] .mobile-chat-input input'));
}

function isRoomChatSendButton(target) {
  return !!(target && target.closest && target.closest('body[data-page="room"] .mobile-chat-input button'));
}

function viewportHeight() {
  return window.visualViewport ? window.visualViewport.height : window.innerHeight;
}

function updateRoomVh() {
  if (!isRoomPage()) return 0;
  const h = viewportHeight();
  if (h) {
    document.documentElement.style.setProperty('--room-vh', Math.round(h) + 'px');
  }
  return h || window.innerHeight || 0;
}

function resetWindowScroll() {
  if (!isRoomPage()) return;
  try { window.scrollTo(0, 0); } catch (e) {}
  try { document.documentElement.scrollTop = 0; } catch (e) {}
  try { document.body.scrollTop = 0; } catch (e) {}
}

function shouldResetWindow() {
  return document.body.classList.contains('mobile-chat-focus') || Date.now() < forceResetUntil;
}

function scheduleLayoutUpdate() {
  if (layoutFrame) cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(function () {
    layoutFrame = 0;
    updateRoomVh();
    if (shouldResetWindow()) {
      resetWindowScroll();
    }
  });
}

function scheduleKeyboardSettling() {
  forceResetUntil = Date.now() + 520;
  scheduleLayoutUpdate();
  setTimeout(scheduleLayoutUpdate, 40);
  setTimeout(scheduleLayoutUpdate, 90);
  setTimeout(scheduleLayoutUpdate, 160);
  setTimeout(scheduleLayoutUpdate, 260);
  setTimeout(scheduleLayoutUpdate, 420);
  setTimeout(scheduleLayoutUpdate, 560);
}

function openChatFocus() {
  if (!isRoomPage()) return;
  clearTimeout(blurTimer);
  document.body.classList.add('mobile-chat-focus');
  scheduleLayoutUpdate();
  setTimeout(scheduleLayoutUpdate, 80);
  setTimeout(scheduleLayoutUpdate, 180);
  setTimeout(scheduleLayoutUpdate, 320);
}

function closeChatFocus(force) {
  clearTimeout(blurTimer);

  const applyClose = function () {
    if (!force && isRoomChatInput(document.activeElement)) return;
    if (document.body) document.body.classList.remove('mobile-chat-focus');
    scheduleKeyboardSettling();
  };

  if (force) {
    applyClose();
    return;
  }

  blurTimer = setTimeout(applyClose, 50);
}

function preCloseBeforeSend(target) {
  if (!isRoomChatSendButton(target)) return;
  closeChatFocus(true);
}

export function initMobileChatFocusFix() {
  if (bound) return;
  bound = true;

  document.addEventListener('focusin', function (e) {
    if (isRoomChatInput(e.target)) openChatFocus();
  }, true);

  document.addEventListener('focusout', function (e) {
    if (isRoomChatInput(e.target)) closeChatFocus(false);
  }, true);

  document.addEventListener('pointerdown', function (e) {
    preCloseBeforeSend(e.target);
  }, true);

  document.addEventListener('touchstart', function (e) {
    preCloseBeforeSend(e.target);
  }, { passive: true, capture: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleLayoutUpdate, { passive: true });
    window.visualViewport.addEventListener('scroll', scheduleLayoutUpdate, { passive: true });
  }

  window.addEventListener('orientationchange', function () {
    forceResetUntil = Date.now() + 600;
    setTimeout(scheduleLayoutUpdate, 80);
    setTimeout(scheduleLayoutUpdate, 260);
  }, { passive: true });

  scheduleLayoutUpdate();
}
