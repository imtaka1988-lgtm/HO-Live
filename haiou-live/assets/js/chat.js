/**
 * 海鸥直播 — WebSocket 聊天室
 */

import { state, asset, esc, href } from './config.js';
import { startChatWarmup, stopChatWarmup, notifyChatActivity } from './chat-warmup.js';

let chatWs = null;
let currentRoomId = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let authWatchTimer = null;
let lastSeenToken = '';

function getToken() {
  return localStorage.getItem('token') || '';
}

function levelClass(level) {
  const lvNum = parseInt(level) || 0;
  if (lvNum >= 9) return 'lv-king';
  if (lvNum >= 7) return 'lv-vip';
  if (lvNum >= 5) return 'lv-high';
  if (lvNum >= 3) return 'lv-mid';
  return 'lv-low';
}

function messageHtml(c) {
  const lv = parseInt(c.level) || 0;
  const name = c.nickname || c.name || '海鸥用户';
  const text = c.message || c.text || '';
  const isAssistant = c.role === 'assistant' || c.role === 'system';
  const isAnchor = !isAssistant && (c.role === 'anchor' || name === (state.cfg.anchorProfile && state.cfg.anchorProfile.name));
  const levelText = isAssistant ? '助手' : (isAnchor ? '主播' : ('Lv.' + lv));
  const msgClass = 'chat-msg' + (isAnchor ? ' chat-msg-anchor' : '') + (isAssistant ? ' chat-msg-assistant' : '');
  const lvClass = isAssistant ? 'lv-assistant' : (isAnchor ? 'lv-anchor' : levelClass(lv));

  return `<div class="${msgClass}">
    <span class="lv ${lvClass}">${esc(levelText)}</span>
    <span class="chat-name">${esc(name)}：</span>
    <span class="chat-text">${esc(text)}</span>
  </div>`;
}

function setChatBodies(html) {
  const pc = document.querySelector('#chatBody');
  const mobile = document.querySelector('#mobileChatBody');
  if (pc) pc.innerHTML = html;
  if (mobile) mobile.innerHTML = html;
  scrollChatBottom();
}

function appendChatMessage(msg) {
  const isWarmup = msg && (msg.__warmup || msg.role === 'assistant' || msg.role === 'system');
  if (!isWarmup) notifyChatActivity();

  const html = messageHtml(msg);
  const pc = document.querySelector('#chatBody');
  const mobile = document.querySelector('#mobileChatBody');

  if (pc) pc.insertAdjacentHTML('beforeend', html);
  if (mobile) mobile.insertAdjacentHTML('beforeend', html);

  scrollChatBottom();
}

function appendSystemNotice(text) {
  appendChatMessage({
    role: 'system',
    nickname: '系统提醒',
    level: 0,
    message: text
  });
}

function scrollChatBottom() {
  ['#chatBody', '#mobileChatBody'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function setInputState(mode) {
  const inputs = document.querySelectorAll('.chat-input input, .mobile-chat-input input');
  const buttons = document.querySelectorAll('.chat-input button, .mobile-chat-input button');

  inputs.forEach(input => {
    input.value = '';
    if (mode === 'login') {
      input.placeholder = '登录后才可以发送消息';
      input.readOnly = true;
    } else if (mode === 'ready') {
      input.placeholder = '请输入聊天内容';
      input.readOnly = false;
    } else {
      input.placeholder = '聊天室连接中...';
      input.readOnly = true;
    }
  });

  buttons.forEach(btn => {
    if (mode === 'login') {
      btn.textContent = '登录';
      btn.disabled = false;
    } else if (mode === 'ready') {
      btn.textContent = '发送';
      btn.disabled = false;
    } else {
      btn.textContent = '连接中';
      btn.disabled = true;
    }
  });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeChatSocketSilently() {
  clearReconnectTimer();
  if (chatWs) {
    chatWs.__manualClose = true;
    try { chatWs.close(); } catch (e) {}
    chatWs = null;
  }
}

function scheduleReconnect() {
  clearReconnectTimer();

  if (!currentRoomId || !getToken()) {
    setInputState('login');
    return;
  }

  reconnectAttempts += 1;
  const delay = Math.min(15000, 1000 * Math.pow(2, Math.min(reconnectAttempts - 1, 4)));
  setInputState('connecting');

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!currentRoomId || !getToken()) {
      setInputState('login');
      return;
    }
    initChatSocket(currentRoomId, { reconnect: true });
  }, delay);
}

function syncAuthState() {
  const token = getToken();
  if (token === lastSeenToken) return;

  lastSeenToken = token;

  if (!token) {
    closeChatSocketSilently();
    setInputState('login');
    appendSystemNotice('你已退出登录，聊天室已切换为未登录状态。');
    return;
  }

  if (currentRoomId) {
    initChatSocket(currentRoomId);
  }
}

function startAuthWatcher() {
  if (authWatchTimer) return;
  lastSeenToken = getToken();

  authWatchTimer = setInterval(syncAuthState, 2000);
  window.addEventListener('storage', syncAuthState);
  window.addEventListener('focus', syncAuthState);
}

/** 渲染聊天消息列表 */
export function renderChatList() {
  const chat = state.cfg.chat || [];
  return chat.map(messageHtml).join('');
}

/** 渲染主播资料 */
export function renderAnchorProfile() {
  const p = state.cfg.anchorProfile;
  if (!p) return '<div class="chat-profile-empty">暂无主播资料</div>';

  const tags = (p.specialties || []).map(s => `<span class="profile-tag">${esc(s)}</span>`).join(' ');

  return `<div class="chat-profile">
    <div class="profile-card"><div class="profile-name">${esc(p.name || '')}</div><div class="profile-intro">${esc(p.intro || '')}</div></div>
    <div class="profile-card"><div class="profile-stat"><span>足球预测准确率</span><b>${esc(p.footballAccuracy || '-')}</b></div><div class="profile-stat"><span>篮球预测准确率</span><b>${esc(p.basketballAccuracy || '-')}</b></div><div class="profile-stat"><span>全站排名</span><b>${esc(p.rank || '-')}</b></div></div>
    <div class="profile-card"><div class="profile-label">擅长赛事</div><div class="profile-tags">${tags}</div></div>
    <div class="profile-card"><div class="profile-label">联系方式</div><div class="profile-contact">${esc(p.contact || '')}</div></div>
    <div class="profile-card profile-qr"><img src="${asset(p.wechatGroupQr || 'assets/img/avatar-default.svg')}" alt="粉丝群二维码"><div class="profile-qr-text">扫码加入主播粉丝群</div></div>
  </div>`;
}

function sendChatMessage(sourceBtn) {
  let input = null;

  if (sourceBtn) {
    const box = sourceBtn.closest('.chat-input, .mobile-chat-input');
    if (box) input = box.querySelector('input');
  }

  if (!input) {
    input = document.querySelector('.chat-input input:not([readonly])') || document.querySelector('.mobile-chat-input input:not([readonly])');
  }

  if (!input) return;

  const text = input.value.trim();

  if (!getToken()) {
    location.href = href('pages/login.html');
    return;
  }

  if (!text) return;

  notifyChatActivity();

  if (!chatWs || chatWs.readyState !== WebSocket.OPEN) {
    setInputState('connecting');
    scheduleReconnect();
    appendSystemNotice('聊天室正在重连，请稍后再发送。');
    return;
  }

  chatWs.send(JSON.stringify({
    type: 'message',
    message: text
  }));

  document.querySelectorAll('.chat-input input, .mobile-chat-input input').forEach(i => {
    i.value = '';
  });
}

function bindChatSendEvents() {
  document.querySelectorAll('.chat-input button, .mobile-chat-input button').forEach(btn => {
    btn.onclick = () => {
      if (!getToken()) {
        location.href = href('pages/login.html');
        return;
      }
      sendChatMessage(btn);
    };
  });

  document.querySelectorAll('.chat-input input, .mobile-chat-input input').forEach(input => {
    input.onkeydown = e => {
      if (e.key === 'Enter') {
        const box = input.closest('.chat-input, .mobile-chat-input');
        const btn = box ? box.querySelector('button') : null;
        sendChatMessage(btn);
      }
    };
  });
}

/** 初始化 WebSocket 聊天 */
export function initChatSocket(roomId, options = {}) {
  currentRoomId = roomId;
  startAuthWatcher();

  if (!options.reconnect) {
    stopChatWarmup();
    startChatWarmup(roomId, appendChatMessage);
  }

  closeChatSocketSilently();

  bindChatSendEvents();

  const token = getToken();
  lastSeenToken = token;

  if (!token) {
    setInputState('login');
    return;
  }

  setInputState('connecting');

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/ws/chat?roomId=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`;

  const ws = new WebSocket(url);
  chatWs = ws;

  ws.onopen = () => {
    if (chatWs !== ws) return;
    reconnectAttempts = 0;
    console.log('[Chat] WebSocket connected', currentRoomId);
  };

  ws.onmessage = event => {
    let data = null;

    try {
      data = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    if (data.type === 'ready') {
      setInputState('ready');
      return;
    }

    if (data.type === 'history') {
      const messages = data.messages || [];
      if (messages.length) {
        setChatBodies(messages.map(messageHtml).join(''));
      }
      return;
    }

    if (data.type === 'message' && data.message) {
      appendChatMessage(data.message);
      return;
    }

    if (data.type === 'error') {
      console.warn('[Chat] error:', data.error);
      closeChatSocketSilently();
      setInputState('login');
    }
  };

  ws.onerror = () => {
    console.warn('[Chat] WebSocket error');
  };

  ws.onclose = () => {
    if (chatWs === ws) chatWs = null;
    if (ws.__manualClose) return;

    if (getToken()) {
      scheduleReconnect();
    } else {
      setInputState('login');
    }
  };
}
