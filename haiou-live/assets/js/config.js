/**
 * 海鸥直播 V4.2 — 配置与共享工具模块
 *
 * 职责：
 *   1. 站点配置加载（site-config.json → state.cfg）
 *   2. 主题 CSS 变量注入
 *   3. base 路径处理、资源 URL 构建
 *   4. 公共工具函数（esc、$、$$、safeJson 等）
 *   5. 数据查询辅助（getHost、getRoom、getMatch）
 *   6. 直播分类筛选
 *
 * 所有模块通过 import { state, $, esc, ... } from './config.js' 使用。
 */

// ===================== 全局状态 =====================

var fallback = {
  brand: { name: '海鸥直播', domain: 's6.lol', logo: 'assets/img/logo.svg', slogan: '高清免费 体育直播', appName: '海鸥直播', version: 'V1.0' },
  theme: { cssVars: {} },
  links: { androidApk: '#', iosApp: '#', backupDomains: ['s6.lol'] },
  banners: [{ title: '激战世界杯', subtitle: '热门赛事', image: 'assets/img/banner-worldcup.svg', href: 'pages/room.html?id=1' }],
  ads: { side: [], bottomText: '下载APP：高清免费体育直播', mobileFloat: '海鸥直播 高清无广告 体育直播' },
  hosts: [],
  rooms: [],
  matches: [],
  anchorProfile: { name: '午后聊球', intro: '专注足球、篮球赛事分析。' },
  chat: []
};
export var state = { cfg: { ...fallback }, q: {}, initDone: false };

// ===================== 页面数据 =====================

export var base = (function () {
  var s = document.querySelector('script[data-base]');
  return (s && s.dataset.base) || '';
})();

export var page = document.body.dataset.page || 'home';

export var qs = new URLSearchParams(location.search);

export var currentTab = qs.get('tab') || '';

// ===================== URL 工具 =====================

export function href(path) {
  path = String(path == null ? '' : path).trim();
  if (!path) return '#';
  if (/^javascript:/i.test(path)) return '#';
  if (/^data:/i.test(path)) return '#';
  if (path === 'index.html' || path === './index.html' || path === '/index.html') return '/';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('#')) return path;
  if (path.startsWith('/')) return path;
  if (path.startsWith('./')) path = path.slice(2);
  while (path.startsWith('../')) path = path.slice(3);
  return '/' + path;
}

export function asset(path) {
  path = String(path == null ? '' : path).trim();
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path)) return path;
  if (/^data:image\/(?:gif|png|jpe?g|webp|svg\+xml);/i.test(path)) return path;
  if (/^data:/i.test(path)) return '';
  if (path.startsWith('/')) return path;
  if (path.startsWith('./')) path = path.slice(2);
  while (path.startsWith('../')) path = path.slice(3);
  return '/' + path;
}

// ===================== HTML 转义 =====================

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>'"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
  });
}

// ===================== DOM 快捷 =====================

export function $(sel) { return document.querySelector(sel); }
export function $$(sel) { return document.querySelectorAll(sel); }

// ===================== JSON 安全解析 =====================

export function safeJson(raw, fallbackVal) {
  try { return JSON.parse(raw); } catch (e) { return fallbackVal !== undefined ? fallbackVal : null; }
}

// ===================== 播放源规范化 =====================

function streamUrlPath(url) {
  var raw = String(url || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, location.href).pathname.toLowerCase();
  } catch (e) {
    return raw.split('?')[0].split('#')[0].toLowerCase();
  }
}

function inferStreamType(stream) {
  var path = streamUrlPath(stream && stream.url);
  if (/\.flv$/i.test(path)) return 'flv';
  if (/\.m3u8$/i.test(path)) return 'hls';
  var declared = String((stream && stream.type) || '').toLowerCase();
  return declared === 'flv' ? 'flv' : 'hls';
}

function isStreamEnabled(stream) {
  if (!stream || !String(stream.url || '').trim()) return false;
  return stream.enabled === undefined || stream.enabled === 1 || stream.enabled === true || stream.enabled === '1' || stream.enabled === 'true';
}

function normalizeApiStreams(streams) {
  return (streams || []).filter(isStreamEnabled).map(function (s) {
    return {
      name: s.name,
      type: inferStreamType(s),
      url: String(s.url || '').trim(),
      provider: 'db',
      enabled: true,
      default: s.default === true,
      priority: s.priority
    };
  });
}

function allowJsonRoomFallback() {
  return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(location.hostname || '');
}

function clearRoomsOnApiFailure(reason) {
  if (allowJsonRoomFallback()) return;
  state.cfg.rooms = [];
  state.cfg.roomsApiFailed = true;
  state.cfg.roomsLoadError = reason || '房间列表加载失败，请稍后刷新';
}

// ===================== 主题注入