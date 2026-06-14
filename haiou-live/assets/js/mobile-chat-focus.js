/**
 * 手机直播间输入法聚焦布局保护
 * 使用事件委托 + inline style，锁定首屏，只允许聊天消息区滚动。
 */

let bound = false;
let blurTimer = null;
let layoutFrame = 0;
let layoutApplied = false;
let savedRootStyle = null;
let savedPageStyle = null;
let savedAppStyle = null;
let savedStageStyle = null;
let savedPanelStyle = null;
let savedVideoStyle = null;
let savedSectionStyle = null;
let savedBodyStyle = null;

function isRoomChatInput(target) {
  return !!(target && target.matches && target.matches('body[data-page="room"] .mobile-chat-input input'));
}

function viewportHeight() {
  return window.visualViewport ? window.visualViewport.height : window.innerHeight;
}

function updateRoomVh() {
  const h = viewportHeight();
  if (h) document.documentElement.style.setProperty('--room-vh', h + 'px');
  return h || window.innerHeight || 0;
}

function saveStyleOnce(el, key) {
  if (!el) return null;
  if (key === 'root' && savedRootStyle === null) savedRootStyle = el.getAttribute('style') || '';
  if (key === 'page' && savedPageStyle === null) savedPageStyle = el.getAttribute('style') || '';
  if (key === 'app' && savedAppStyle === null) savedAppStyle = el.getAttribute('style') || '';
  if (key === 'stage' && savedStageStyle === null) savedStageStyle = el.getAttribute('style') || '';
  if (key === 'panel' && savedPanelStyle === null) savedPanelStyle = el.getAttribute('style') || '';
  if (key === 'video' && savedVideoStyle === null) savedVideoStyle = el.getAttribute('style') || '';
  if (key === 'section' && savedSectionStyle === null) savedSectionStyle = el.getAttribute('style') || '';
  if (key === 'body' && savedBodyStyle === null) savedBodyStyle = el.getAttribute('style') || '';
  return el;
}

function restoreStyle(el, value) {
  if (!el || value === null) return;
  if (value) el.setAttribute('style', value);
  else el.removeAttribute('style');
}

function writeLockedLayout() {
  layoutFrame = 0;
  const h = updateRoomVh();
  const root = saveStyleOnce(document.documentElement, 'root');
  const page = saveStyleOnce(document.body, 'page');
  const app = saveStyleOnce(document.querySelector('#app'), 'app');
  const stage = saveStyleOnce(document.querySelector('body[data-page="room"] .room-stage'), 'stage');
  const panel = saveStyleOnce(document.querySelector('body[data-page="room"] .player-panel'), 'panel');
  const video = saveStyleOnce(document.querySelector('body[data-page="room"] .video-box'), 'video');
  const section = saveStyleOnce(document.querySelector('body[data-page="room"] .mobile-chat-section'), 'section');
  const body = saveStyleOnce(document.querySelector('body[data-page="room"] .mobile-chat-body:not(.hide)'), 'body');

  if (root) {
    root.style.setProperty('height', '100%', 'important');
    root.style.setProperty('overflow', 'hidden', 'important');
  }

  if (page) {
    page.style.setProperty('position', 'fixed', 'important');
    page.style.setProperty('inset', '0', 'important');
    page.style.setProperty('width', '100%', 'important');
    page.style.setProperty('height', h + 'px', 'important');
    page.style.setProperty('overflow', 'hidden', 'important');
  }

  if (app) {
    app.style.setProperty('height', h + 'px', 'important');
    app.style.setProperty('overflow', 'hidden', 'important');
  }

  if (stage) {
    stage.style.setProperty('height', 'calc(' + h + 'px - 42px)', 'important');
    stage.style.setProperty('overflow', 'hidden', 'important');
  }

  if (panel) {
    panel.style.setProperty('height', '100%', 'important');
    panel.style.setProperty('min-height', '0', 'important');
    panel.style.setProperty('overflow', 'hidden', 'important');
  }

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
    body.style.setProperty('overflow-x', 'hidden', 'important');
    body.style.setProperty('overflow-y', 'auto', 'important');
  }

  layoutApplied = true;
}

function scheduleLockedLayout() {
  if (layoutFrame) cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(writeLockedLayout);
}

function restoreInlineFocusLayout() {
  if (layoutFrame) cancelAnimationFrame(layoutFrame);
  layoutFrame = 0;

  restoreStyle(document.documentElement, savedRootStyle);
  restoreStyle(document.body, savedPageStyle);
  restoreStyle(document.querySelector('#app'), savedAppStyle);
  restoreStyle(document.querySelector('body[data-page="room"] .room-stage'), savedStageStyle);
  restoreStyle(document.querySelector('body[data-page="room"] .player-panel'), savedPanelStyle);
  restoreStyle(document.querySelector('body[data-page="room"] .video-box'), savedVideoStyle);
  restoreStyle(document.querySelector('body[data-page="room"] .mobile-chat-section'), savedSectionStyle);
  restoreStyle(document.querySelector('body[data-page="room"] .mobile-chat-body:not(.hide)'), savedBodyStyle);

  layoutApplied = false;
  savedRootStyle = null;
  savedPageStyle = null;
  savedAppStyle = null;
  savedStageStyle = null;
  savedPanelStyle = null;
  savedVideoStyle = null;
  savedSectionStyle = null;
  savedBodyStyle = null;
}

function openChatFocus() {
  clearTimeout(blurTimer);
  document.body.classList.add('mobile-chat-focus');
  scheduleLockedLayout();
  setTimeout(scheduleLockedLayout, 140);
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
      if (document.body.classList.contains('mobile-chat-focus') || layoutApplied) scheduleLockedLayout();
    }, { passive: true });
  }
}
