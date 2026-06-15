/**
 * 海鸥直播 V4.2 — API 请求封装
 *
 * 策略：
 *   优先请求后台 API
 *   请求失败时回退到 site-config.json 本地兜底
 *
 * 当前阶段所有函数直接走 JSON 兜底（后端未就绪时），
 * 后续后端上线后只需修改 fetch URL 即可。
 */

import { state, loadConfig } from './config.js';

// ===================== 基础请求 =====================

const API_BASE = ''; // 后续改成 'https://api.s6.lol'

async function apiGet(path) {
  return fetch(`${API_BASE}${path}`).then(r => {
    if (!r.ok) throw new Error(`API ${path} → ${r.status}`);
    return r.json();
  });
}

async function readJsonResponse(res, fallbackMessage) {
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    return data || { ok: false, error: fallbackMessage || `请求失败，请稍后重试（${res.status}）` };
  }

  return data;
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return readJsonResponse(res);
}

// ===================== 直播室 API =====================

export async function getRoomDetail(roomId) {
  try {
    return await apiGet(`/api/rooms/${roomId}`);
  } catch {
    return null;
  }
}

export async function getChatMessages(roomId) {
  try {
    return await apiGet(`/api/rooms/${roomId}/messages`);
  } catch {
    return state.cfg.chat || [];
  }
}

// ===================== 用户 API =====================

export async function registerUser(phone, password, nickname) {
  try {
    return await apiPost('/api/auth/register', { phone, password, nickname });
  } catch {
    return null;
  }
}

export async function loginUser(phone, password) {
  try {
    return await apiPost('/api/auth/login', { phone, password });
  } catch {
    return null;
  }
}

export async function getUserInfo(token) {
  try {
    const res = await fetch('/api/user/me', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function getUserFollows(token) {
  try {
    const res = await fetch('/api/user/follows', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function getRoomFollowStatus(roomId, token) {
  try {
    const res = await fetch(`/api/user/follows/rooms/${roomId}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function followRoom(roomId, token) {
  try {
    const res = await fetch(`/api/user/follows/rooms/${roomId}`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function unfollowRoom(roomId, token) {
  try {
    const res = await fetch(`/api/user/follows/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    return await res.json();
  } catch {
    return null;
  }
}

// ===================== Admin API =====================

export async function adminLogin(username, password) {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error('Login failed');
    return await res.json();
  } catch {
    return null;
  }
}

export async function adminGetMe(token) {
  try {
    const res = await fetch('/api/admin/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Auth failed');
    return await res.json();
  } catch {
    return null;
  }
}

export async function adminGetRooms(token) {
  try {
    const res = await fetch('/api/admin/rooms', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Auth failed');
    return await res.json();
  } catch {
    return null;
  }
}

export async function adminUpdateRoom(roomId, data, token) {
  try {
    const res = await fetch(`/api/admin/rooms/${roomId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Update failed');
    return await res.json();
  } catch {
    return null;
  }
}

export async function adminUpdateStream(roomId, streamId, data, token) {
  try {
    const res = await fetch(`/api/admin/rooms/${roomId}/streams/${streamId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(data)
    });
    return await readJsonResponse(res, '播放源保存失败');
  } catch {
    return { ok: false, error: '网络异常，播放源保存失败' };
  }
}

// ===================== 初始化 =====================

export { loadConfig };


export async function adminCreateStream(roomId, data, token) {
  try {
    const res = await fetch(`/api/admin/rooms/${roomId}/streams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(data)
    });
    return await readJsonResponse(res, '播放源新增失败');
  } catch {
    return { ok: false, error: '网络异常，播放源新增失败' };
  }
}


export async function adminDeleteStream(roomId, streamId, token) {
  try {
    const res = await fetch(`/api/admin/rooms/${roomId}/streams/${streamId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    return await res.json();
  } catch {
    return null;
  }
}


export async function adminCreateRoom(data, token) {
  try {
    const res = await fetch('/api/admin/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch {
    return null;
  }
}


export async function adminDeleteRoom(roomId, token) {
  try {
    const res = await fetch(`/api/admin/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    return await res.json();
  } catch {
    return null;
  }
}
