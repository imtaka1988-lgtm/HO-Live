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

// ===================== 主题注入 =====================

export function applyTheme(cfg) {
  var vars =
    (cfg && cfg.theme && cfg.theme.cssVars) ||
    (cfg && cfg.cssVars) ||
    {};

  Object.entries(vars).forEach(function (entry) {
    var key = entry[0];
    var value = entry[1];
    if (!key || value == null) return;
    var name = key.startsWith('--') ? key : '--' + key;
    document.documentElement.style.setProperty(name, value);
  });
}

// ===================== 配置加载 =====================

export async function loadConfig() {
  if (state.initDone) return state.cfg;

  // 1. 加载基础配置（品牌、主题、广告等）从 JSON 兜底
  try {
    var r = await fetch(href('assets/data/site-config.json') + '?t=' + Date.now());
    if (!r.ok) throw new Error(r.status);
    var json = await r.json();
    state.cfg = { ...fallback, ...json };
  } catch (e) {
    console.warn('[Config] using fallback config', e.message);
    state.cfg = { ...fallback };
  }

  // 2. 尝试从后端 API 获取 rooms（含 streams）, 失败则保留 JSON 中的 rooms
  try {
    var apiRes = await fetch('/api/public/rooms');
    if (apiRes.ok) {
      var apiData = await apiRes.json();
       if (apiData.ok && Array.isArray(apiData.rooms)) {
         // 转换后端字段名到前端格式
         state.cfg.rooms = apiData.rooms.map(function (r) {
           return {
             id: r.id,
             title: r.title,
             subTitle: r.subTitle || r.title,
             category: r.category,
             cover: r.cover,
             poster: r.cover,
             isLive: r.status === 'live',
             status: r.status,
             quality: '高清',
             sort: r.sortOrder !== undefined ? r.sortOrder : r.sort,
             anchorName: r.anchorName || '',
             anchorAvatar: r.anchorAvatar || '',
             announcement: r.announcement || '',
             hostId: r.anchorName ? ('h' + r.id) : 'h1',
             streamUrl: (r.streams && r.streams[0] && r.streams[0].url) || '',
             streams: (r.streams || []).map(function (s) {
               return {
                 name: s.name,
                 type: s.type,
                 url: s.url,
                 provider: 'db',
                 enabled: s.enabled === 1,
                 default: s.default === true,
                 priority: s.priority
               };
             }),
             viewers: '0'
           };
         });
       }
    }
  } catch (e) {
    console.log('[Config] API /api/public/rooms 不可用，使用 JSON 兜底');
  }

  // 注入 CSS 变量
  var vars = state.cfg.theme && state.cfg.theme.cssVars ? state.cfg.theme.cssVars : {};
  var root = document.documentElement;
  Object.keys(vars || {}).forEach(function (k) {
    if (vars[k]) root.style.setProperty(k, vars[k]);
  });

  state.initDone = true;
  return state.cfg;
}

// ===================== 数据查询 =====================

export function getHost(id) {
  return state.cfg.hosts.find(function (h) { return h.id === id; }) || { id: '', name: '未知主播', avatar: 'assets/img/avatar-default.svg' };
}

export function getRoom(id) {
  return state.cfg.rooms.find(function (r) { return String(r.id) === String(id); }) || state.cfg.rooms[0] || {};
}

export function getMatch(id) {
  return state.cfg.matches.find(function (m) { return String(m.id) === String(id); }) || null;
}

export function filterRoomsForTab(tab) {
  tab = tab || currentTab;
  if (!tab || tab === 'all' || tab === 'recommend') return state.cfg.rooms;
  if (tab === 'football') return state.cfg.rooms.filter(function (r) { return r.category === 'football'; });
  if (tab === 'basketball') return state.cfg.rooms.filter(function (r) { return r.category === 'basketball'; });
  if (tab === 'analysis') return state.cfg.rooms.filter(function (r) { return r.category === 'analysis'; });
  return state.cfg.rooms;
}
