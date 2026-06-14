/**
 * 手机直播间输入法聚焦布局保护
 * 使用事件委托 + inline style，避免 CSS 优先级或输入框替换导致失效。
 */

let bound = false;
let blurTimer = null;
let savedVideoStyle = null;
let savedSectionStyle = null;
let savedBodyStyle = null;

function isRoomChatInput(target) {
  return !!(target && target.matches && target.matches('body[data-page="room"] .mobile-chat-input input'));
}

function updateRoomVh() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (h) document.documentElement.style.setProperty('--room-vh', h + 'px');
}

function applyInlineFocusLayout() {
  const video = document.querySelector('body[data-page="room"] .video-box');
  const section = document.querySelector('body[data-page="room"] .mobile-chat-section');
  const body = document.querySelector('body[data-page="room"] .mobile-chat-body:not(.hide)');

  if (video && savedVideoStyle === null) savedVideoStyle = video.getAttribute('style') || '';
  if (section && savedSectionStyle === null) savedSectionStyle = section.getAttribute('style') || '';
  if (body && savedBodyStyle === null) savedBodyStyle = body.getAttribute('style') || '';

  if (video) {
    video.style.setProperty('height', '0', 'important');
    video.style.setProperty('min-height', '0', 'important');
    video.style.setProperty('max-height', '0', 'important');
    video.style.setProperty('flex', '0 0 0', 'important');
    video.style.setProperty('overflow', 'hidden', 'important');
    video.style.setProperty('visibility', 'hidden', 'important');
  }

  if (section) {
    section.style.setProperty('flex', '1 1 auto', 'important');
    section.style.setProperty('height', '100%', 'important');
    section.style.setProperty('min-height', '0', 'important');
    section.style.setProperty('overflow', 'hidden', 'important');
  }

  if (body) {
    body.style.setProperty('flex', '1 1 auto', 'important');
    body.style.setProperty('min-height', '0', 'important');
    body.style.setProperty('overflow-y', 'auto', 'important');
  }
}

function restoreInlineFocusLayout() {
  const video = document.querySelector('body[data-page="room"] .video-box');
  const section = document.querySelector('body[data-page="room"] .mobile-chat-section');
  const body = document.querySelector('body[data-page="room"] .mobile-chat-body:not(.hide)');

  if (video && savedVideoStyle !== null) video.setAttribute('style', savedVideoStyle);
  if (section && savedSectionStyle !== null) section.setAttribute('style', savedSectionStyle);
  if (body && savedBodyStyle !== null) body.setAttribute('style', savedBodyStyle);

  savedVideoStyle = null;
  savedSectionStyle = null;
  savedBodyStyle = null;
}

function openChatFocus() {
  clearTimeout(blurTimer);
  updateRoomVh();
  document.body.classList.add('mobile-chat-focus');
  applyInlineFocusLayout();
  setTimeout(function () { updateRoomVh(); applyInlineFocusLayout(); }, 80);
  setTimeout(function () { updateRoomVh(); applyInlineFocusLayout(); }, 220);
}

function closeChatFocus() {
  clearTimeout(blurTimer);
  blurTimer = setTimeout(function () {
    if (isRoomChatInput(document.activeElement)) return;
    document.body.classList.remove('mobile-chat-focus');
    restoreInlineFocusLayout();
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
      if (document.body.classList.contains('mobile-chat-focus')) {
        updateRoomVh();
        applyInlineFocusLayout();
      }
    }, { passive: true });
  }
}
