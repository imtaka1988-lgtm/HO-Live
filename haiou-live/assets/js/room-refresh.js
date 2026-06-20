/**
 * 直播间公告 / 状态轻量刷新
 * - 每 15 秒读取一次公开房间列表
 * - 公告变更：直接更新直播间公告文案
 * - 头像变更：直接更新直播间主播头像与资料区图片
 * - 状态变更：刷新当前直播间，让播放器状态重新渲染
 */

import { asset } from './config.js';

let timer = null;

function updateNotice(text) {
  const value = '📢 公告：' + (text || '欢迎进入直播间，请文明发言');
  document.querySelectorAll('.chat-notice, .mobile-chat-notice').forEach(el => {
    if (el.textContent !== value) el.textContent = value;
  });
}

function updateAnchorAvatar(avatar) {
  if (!avatar) return;
  const src = asset(avatar);
  document.querySelectorAll('.player-host img, .profile-qr img').forEach(img => {
    if (img && img.getAttribute('src') !== src) img.setAttribute('src', src);
  });
}

export function stopRoomInfoPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function startRoomInfoPolling(roomId) {
  stopRoomInfoPolling();

  timer = setInterval(async () => {
    if (document.body.dataset.page !== 'room') {
      stopRoomInfoPolling();
      return;
    }

    try {
      const res = await fetch('/api/public/rooms?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      if (!data.ok || !Array.isArray(data.rooms)) return;

      const freshRoom = data.rooms.find(r => String(r.id) === String(roomId));
      if (!freshRoom) return;

      updateNotice(freshRoom.announcement || '欢迎进入直播间，请文明发言');
      updateAnchorAvatar(freshRoom.anchorAvatar || '');

      const titleEl = document.querySelector('.player-host h1');
      if (titleEl && freshRoom.title && titleEl.textContent !== freshRoom.title) {
        titleEl.textContent = freshRoom.title;
      }

      const videoBox = document.querySelector('#videoBox');
      const oldStatus = String((videoBox && videoBox.dataset.roomStatus) || 'live').toLowerCase();
      const newStatus = String(freshRoom.status || 'live').toLowerCase();

      if (oldStatus !== newStatus) {
        location.reload();
      }
    } catch (e) {
      // 静默失败，下一轮继续；不影响播放和聊天。
    }
  }, 15000);
}
