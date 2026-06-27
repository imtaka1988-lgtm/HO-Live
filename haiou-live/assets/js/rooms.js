/** 海鸥直播 V4.2 — 首页与直播列表模块 */
import { state, href, asset, esc, getHost, filterRoomsForTab, currentTab } from './config.js';
import { liveCard, horizontalMatchCard, mobileFloatAd, bindFloatBarEvents } from './ui.js';
import { renderHomeReplaySection, initHomeReplays } from './replays.js';

const HERO_CARD_LIMIT = 5;
const HERO_REFRESH_MS = 30000;
let heroRefreshInFlight = false;

function roomSortValue(room) {
  const n = Number(room && room.sort !== undefined ? room.sort : 0);
  return Number.isFinite(n) ? n : 0;
}

function isLiveRoom(room) {
  return !!room && (room.status === 'live' || room.isLive === true);
}

function getHeroRooms(rooms) {
  const list = Array.isArray(rooms) ? rooms.slice() : [];
  const liveRooms = list.filter(isLiveRoom);
  const source = liveRooms.length ? liveRooms : list;
  return source.slice().sort((a, b) => roomSortValue(a) - roomSortValue(b)).slice(0, HERO_CARD_LIMIT);
}

function heroCardHtml(room, activeId) {
  const isActive = String(room.id) === String(activeId);
  return `<div class="hero-side-card ${isActive ? 'is-active' : ''}" data-room-id="${esc(room.id)}" data-cover="${asset(room.cover)}" data-title="${esc(room.title)}"><img src="${asset(room.cover)}" alt="${esc(room.title)}"></div>`;
}

function renderHeroSideCards(heroRooms, activeId) {
  const fallbackActiveId = activeId !== undefined && activeId !== null ? activeId : (heroRooms[0] && heroRooms[0].id);
  return heroRooms.map(r => heroCardHtml(r, fallbackActiveId)).join('');
}

function streamUrlPath(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, location.href).pathname.toLowerCase();
  } catch (e) {
    return raw.split('?')[0].split('#')[0].toLowerCase();
  }
}

function inferStreamType(stream) {
  const path = streamUrlPath(stream && stream.url);
  if (/\.flv$/i.test(path)) return 'flv';
  if (/\.m3u8$/i.test(path)) return 'hls';
  const declared = String((stream && stream.type) || '').toLowerCase();
  return declared === 'flv' ? 'flv' : 'hls';
}

function isStreamEnabled(stream) {
  if (!stream || !String(stream.url || '').trim()) return false;
  return stream.enabled === undefined || stream.enabled === 1 || stream.enabled === true || stream.enabled === '1' || stream.enabled === 'true';
}

function normalizeStreams(streams, fallbackStreams) {
  const rawStreams = Array.isArray(streams) ? streams : [];
  const normalized = rawStreams.filter(isStreamEnabled).map(s => ({
    ...s,
    type: inferStreamType(s),
    url: String(s.url || '').trim(),
    enabled: true
  }));
  return normalized.length ? normalized : (Array.isArray(fallbackStreams) ? fallbackStreams : []);
}

function normalizeApiRoom(rawRoom, currentRoom) {
  const raw = rawRoom || {};
  const current = currentRoom || {};
  const streams = normalizeStreams(raw.streams, current.streams);
  const streamUrl = (streams[0] && streams[0].url) || raw.streamUrl || current.streamUrl || '';
  const id = raw.id !== undefined && raw.id !== null ? raw.id : current.id;
  const status = raw.status || current.status || 'offline';

  return {
    ...current,
    id,
    title: raw.title || current.title || '',
    subTitle: raw.subTitle || raw.title || current.subTitle || current.title || '',
    category: raw.category || current.category || '',
    cover: raw.cover || current.cover || '',
    poster: raw.cover || current.poster || current.cover || '',
    isLive: status === 'live',
    status,
    quality: current.quality || '高清',
    sort: raw.sortOrder !== undefined ? raw.sortOrder : (raw.sort !== undefined ? raw.sort : current.sort),
    anchorName: raw.anchorName || current.anchorName || '',
    anchorAvatar: raw.anchorAvatar || current.anchorAvatar || '',
    announcement: raw.announcement || current.announcement || '',
    hostId: raw.anchorName && id !== undefined && id !== null ? ('h' + id) : (current.hostId || 'h1'),
    streamUrl,
    streams,
    viewers: current.viewers || '0'
  };
}

function normalizeApiRooms(apiRooms) {
  const currentById = new Map((Array.isArray(state.cfg.rooms) ? state.cfg.rooms : []).map(r => [String(r.id), r]));
  return apiRooms.map(raw => normalizeApiRoom(raw, currentById.get(String(raw && raw.id))));
}

function heroSignature(heroRooms) {
  return heroRooms.map(r => [r.id, r.status, r.cover, r.title, r.streamUrl].join('\u0001')).join('\u0002');
}

function bindHeroCardClicks(zone, enterBtn) {
  const cards = document.querySelectorAll('#heroSideCards .hero-side-card');
  if (!zone || !cards.length) return;
  cards.forEach(card => {
    card.addEventListener('click', function () {
      const rid = this.dataset.roomId;
      const cover = this.dataset.cover;
      cards.forEach(c => c.classList.remove('is-active'));
      this.classList.add('is-active');
      zone.style.backgroundImage = `url(${cover})`;
      zone.dataset.roomId = rid;
      if (enterBtn) enterBtn.href = href('pages/room.html?id=' + rid);
      const room = state.cfg.rooms.find(r => String(r.id) === String(rid));
      if (room) playHeroPreview(room);
    });
  });
}

function rebuildHero(heroRooms, preferredRoomId) {
  const zone = document.querySelector('#heroPlayerZone');
  const cardsWrap = document.querySelector('#heroSideCards');
  const enterBtn = document.querySelector('#heroEnterBtn');
  if (!zone || !cardsWrap) return;

  const activeRoom = heroRooms.find(r => String(r.id) === String(preferredRoomId)) || heroRooms[0];
  if (!activeRoom) {
    cardsWrap.innerHTML = '';
    return;
  }

  cardsWrap.innerHTML = renderHeroSideCards(heroRooms, activeRoom.id);
  const cover = asset(activeRoom.cover || activeRoom.poster || 'assets/img/thumb-1.svg');
  zone.style.backgroundImage = `url(${cover})`;
  zone.dataset.roomId = activeRoom.id;
  if (enterBtn) enterBtn.href = href('pages/room.html?id=' + activeRoom.id);
  playHeroPreview(activeRoom);
  bindHeroCardClicks(zone, enterBtn);
}

async function refreshHeroRooms() {
  if (heroRefreshInFlight) return;
  heroRefreshInFlight = true;

  try {
    const res = await fetch('/api/public/rooms?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.rooms)) return;

    const currentHeroRooms = getHeroRooms(state.cfg.rooms);
    const nextRooms = normalizeApiRooms(data.rooms);
    const nextHeroRooms = getHeroRooms(nextRooms);
    state.cfg.rooms = nextRooms;

    if (heroSignature(currentHeroRooms) === heroSignature(nextHeroRooms)) return;

    const currentActiveId = document.querySelector('#heroPlayerZone')?.dataset.roomId;
    rebuildHero(nextHeroRooms, currentActiveId);
  } catch (e) {
    console.warn('[Hero] refresh rooms failed', e);
  } finally {
    heroRefreshInFlight = false;
  }
}

function startHeroAutoRefresh() {
  if (state.cfg && state.cfg.heroAutoRefresh === false) return;
  if (window._heroAutoRefreshTimer) clearInterval(window._heroAutoRefreshTimer);
  window._heroAutoRefreshTimer = setInterval(refreshHeroRooms, HERO_REFRESH_MS);
}

export function renderHome() {
  const cfg = state.cfg;
  const heroRooms = getHeroRooms(cfg.rooms);
  const defaultRoom = heroRooms[0] || {};
  return `<section class="home-hero pc-only"><div class="home-hero-inner"><div class="hero-player-zone" id="heroPlayerZone" style="background-image:url(${asset(defaultRoom.cover||'assets/img/thumb-1.svg')})" data-room-id="${defaultRoom.id||1}"><video id="heroPreviewVideo" class="hero-preview-video" muted autoplay playsinline preload="metadata" poster="${asset(defaultRoom.cover||'assets/img/thumb-1.svg')}"></video><a class="hero-enter-btn" id="heroEnterBtn" href="${href('pages/room.html?id='+(defaultRoom.id||1))}">进入直播间</a></div><div class="hero-side-cards" id="heroSideCards">${renderHeroSideCards(heroRooms, defaultRoom.id)}</div></div></section><main class="home-main pc-only"><div class="container"><div class="section-head"><h2>正在热播</h2><a href="${href('pages/live.html')}">查看更多 ›</a></div><div class="live-grid">${cfg.rooms.slice(0,10).map(r=>liveCard(r)).join('')}</div><div class="section-head"><h2>足球直播</h2><a href="${href('pages/live.html?tab=football')}">查看更多 ›</a></div><div class="live-grid">${cfg.rooms.filter(r=>r.category==='football').slice(0,5).map(r=>liveCard(r)).join('')}</div><div class="section-head"><h2>篮球直播</h2><a href="${href('pages/live.html?tab=basketball')}">查看更多 ›</a></div><div class="live-grid">${cfg.rooms.filter(r=>r.category==='basketball').slice(0,5).map(r=>liveCard(r)).join('')}</div>${renderHomeReplaySection()}</div></main>${renderMobileHome()}`;
}

export function bindHeroEvents() {
  const zone=document.querySelector('#heroPlayerZone'),enterBtn=document.querySelector('#heroEnterBtn'),header=document.querySelector('#siteHeader');
  const heroRooms=getHeroRooms(state.cfg.rooms);if(heroRooms.length)playHeroPreview(heroRooms[0]);
  bindHeroCardClicks(zone, enterBtn);
  if(header&&!header._heroScrollBound){header._heroScrollBound=true;header.classList.add('is-hero');const onHeroScroll=()=>{if(window.scrollY>80)header.classList.remove('is-hero');else header.classList.add('is-hero')};window.addEventListener('scroll',onHeroScroll,{passive:true});window.addEventListener('beforeunload',()=>window.removeEventListener('scroll',onHeroScroll),{once:true})}
  initHomeReplays();
  startHeroAutoRefresh();
}

let heroHlsInstance=null;
function getHeroPreviewUrl(room){if(!room)return'';if(Array.isArray(room.streams)){const hls=room.streams.find(s=>s.enabled!==false&&s.type==='hls'&&s.url);if(hls)return hls.url}return room.streamUrl||''}
function playHeroPreview(room){const zone=document.querySelector('#heroPlayerZone'),video=document.querySelector('#heroPreviewVideo');if(!zone||!video||!room)return;const url=getHeroPreviewUrl(room),cover=asset(room.cover||room.poster||'assets/img/thumb-1.svg');zone.style.backgroundImage=`url(${cover})`;video.poster=cover;video.classList.remove('is-ready');if(heroHlsInstance){heroHlsInstance.destroy();heroHlsInstance=null}video.pause();video.removeAttribute('src');video.load();if(!url)return;video.muted=true;video.playsInline=true;const show=()=>video.classList.add('is-ready'),hide=()=>video.classList.remove('is-ready');video.onplaying=show;video.oncanplay=show;video.onerror=hide;if(window.Hls&&window.Hls.isSupported()){heroHlsInstance=new window.Hls({enableWorker:true,lowLatencyMode:false,backBufferLength:30});heroHlsInstance.loadSource(url);heroHlsInstance.attachMedia(video);heroHlsInstance.on(window.Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>hide()));heroHlsInstance.on(window.Hls.Events.ERROR,(event,data)=>{if(data&&data.fatal)hide()})}else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;video.play().catch(()=>hide())}}

function renderMobileHome(){
  const cfg=state.cfg;setTimeout(bindFloatBarEvents,100);
  const heroHtml=getHeroRooms(cfg.rooms).map(r=>`<a class="m-hero-card" href="${href('pages/room.html?id='+r.id)}"><img src="${asset(r.cover||'assets/img/thumb-1.svg')}" alt="${esc(r.title)}"><span class="m-hero-title">${esc(r.title)}</span></a>`).join('');
  return `<main class="mobile-page"><div class="m-hero-scroll" id="mHeroScroll">${heroHtml}</div><div class="m-section-title">正在热播</div><div class="m-live-grid">${filterRoomsForTab().slice(0,8).map(r=>liveCard(r)).join('')}</div><div class="m-section-title">足球直播</div><div class="m-live-grid">${cfg.rooms.filter(r=>r.category==='football').slice(0,4).map(r=>liveCard(r)).join('')}</div><div class="m-section-title">篮球直播</div><div class="m-live-grid">${cfg.rooms.filter(r=>r.category==='basketball').slice(0,4).map(r=>liveCard(r)).join('')}</div>${mobileFloatAd()}</main>`;
}

export function renderLive(){
  const labels=[['all','全部'],['football','足球'],['basketball','篮球'],['analysis','分析']];
  const rooms=filterRoomsForTab();setTimeout(bindFloatBarEvents,100);
  return `<main class="page-shell pc-only"><div class="container"><div class="tab-row">${labels.map(([k,t])=>`<a class="${(currentTab===k||(!new URLSearchParams(location.search).get('tab')&&k==='all'))?'is-active':''}" href="${href(`pages/live.html${k==='all'?'':`?tab=${k}`}`)}">${t}</a>`).join('')}</div><div class="live-grid">${rooms.map(r=>liveCard(r)).join('')}</div></div></main><main class="mobile-page"><div class="m-live-grid" style="padding-top:14px">${rooms.map(r=>liveCard(r)).join('')}</div>${mobileFloatAd()}</main>`;
}
