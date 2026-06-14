/** 海鸥直播 V4.2 — 首页与直播列表模块 */
import { state, href, asset, esc, getHost, filterRoomsForTab, currentTab } from './config.js';
import { liveCard, horizontalMatchCard, mobileFloatAd, bindFloatBarEvents } from './ui.js';
import { leagueName, matchName } from './odds-i18n.js';
import { renderHomeReplaySection, initHomeReplays } from './replays.js';

export function renderHome() {
  const cfg = state.cfg;
  const heroRooms = cfg.rooms.slice(0, 5);
  const defaultRoom = heroRooms[0] || {};
  return `<section class="home-hero pc-only"><div class="home-hero-inner"><div class="hero-player-zone" id="heroPlayerZone" style="background-image:url(${asset(defaultRoom.cover||'assets/img/thumb-1.svg')})" data-room-id="${defaultRoom.id||1}"><video id="heroPreviewVideo" class="hero-preview-video" muted autoplay playsinline preload="metadata" poster="${asset(defaultRoom.cover||'assets/img/thumb-1.svg')}"></video><a class="hero-enter-btn" id="heroEnterBtn" href="${href('pages/room.html?id='+(defaultRoom.id||1))}">进入直播间</a></div><div class="hero-side-cards" id="heroSideCards">${heroRooms.map((r,i)=>`<div class="hero-side-card ${i===0?'is-active':''}" data-room-id="${r.id}" data-cover="${asset(r.cover)}" data-title="${esc(r.title)}"><img src="${asset(r.cover)}" alt="${esc(r.title)}"></div>`).join('')}</div></div></section><main class="home-main pc-only"><div class="container"><div class="section-head" id="pcHomeOddsTitle" style="display:none"><h2>热门赛事指数</h2></div><div class="pc-home-odds-section" id="pcHomeOddsSection" style="display:none"><div class="odds-scroll" data-odds-scroll id="pcHomeOddsScroll"></div><p class="odds-disclaimer" style="color:#999;font-size:11px;margin-top:4px">数据仅供赛事参考</p></div><div class="section-head"><h2>正在热播</h2><a href="${href('pages/live.html')}">查看更多 ›</a></div><div class="live-grid">${cfg.rooms.slice(0,10).map(r=>liveCard(r)).join('')}</div><div class="section-head"><h2>足球直播</h2><a href="${href('pages/live.html?tab=football')}">查看更多 ›</a></div><div class="live-grid">${cfg.rooms.filter(r=>r.category==='football').slice(0,5).map(r=>liveCard(r)).join('')}</div><div class="section-head"><h2>篮球直播</h2><a href="${href('pages/live.html?tab=basketball')}">查看更多 ›</a></div><div class="live-grid">${cfg.rooms.filter(r=>r.category==='basketball').slice(0,5).map(r=>liveCard(r)).join('')}</div>${renderHomeReplaySection()}</div></main>${renderMobileHome()}`;
}

export function bindHeroEvents() {
  const zone=document.querySelector('#heroPlayerZone'),cards=document.querySelectorAll('#heroSideCards .hero-side-card'),enterBtn=document.querySelector('#heroEnterBtn'),header=document.querySelector('#siteHeader');
  const heroRooms=state.cfg.rooms.slice(0,5);if(heroRooms.length)playHeroPreview(heroRooms[0]);
  if(zone&&cards.length){cards.forEach(card=>{card.addEventListener('click',function(){const rid=this.dataset.roomId,cover=this.dataset.cover;cards.forEach(c=>c.classList.remove('is-active'));this.classList.add('is-active');zone.style.backgroundImage=`url(${cover})`;zone.dataset.roomId=rid;if(enterBtn)enterBtn.href=`pages/room.html?id=${rid}`;const room=state.cfg.rooms.find(r=>String(r.id)===String(rid));if(room)playHeroPreview(room);})})}
  if(header&&!header._heroScrollBound){header._heroScrollBound=true;header.classList.add('is-hero');const onHeroScroll=()=>{if(window.scrollY>80)header.classList.remove('is-hero');else header.classList.add('is-hero')};window.addEventListener('scroll',onHeroScroll,{passive:true});window.addEventListener('beforeunload',()=>window.removeEventListener('scroll',onHeroScroll),{once:true})}
  loadPcHomeOdds();
  initHomeReplays();
}

let heroHlsInstance=null;
function getHeroPreviewUrl(room){if(!room)return'';if(Array.isArray(room.streams)){const hls=room.streams.find(s=>s.enabled!==false&&s.type==='hls'&&s.url);if(hls)return hls.url}return room.streamUrl||''}
function playHeroPreview(room){const zone=document.querySelector('#heroPlayerZone'),video=document.querySelector('#heroPreviewVideo');if(!zone||!video||!room)return;const url=getHeroPreviewUrl(room),cover=asset(room.cover||room.poster||'assets/img/thumb-1.svg');zone.style.backgroundImage=`url(${cover})`;video.poster=cover;video.classList.remove('is-ready');if(heroHlsInstance){heroHlsInstance.destroy();heroHlsInstance=null}video.pause();video.removeAttribute('src');video.load();if(!url)return;video.muted=true;video.playsInline=true;const show=()=>video.classList.add('is-ready'),hide=()=>video.classList.remove('is-ready');video.onplaying=show;video.oncanplay=show;video.onerror=hide;if(window.Hls&&window.Hls.isSupported()){heroHlsInstance=new window.Hls({enableWorker:true,lowLatencyMode:false,backBufferLength:30});heroHlsInstance.loadSource(url);heroHlsInstance.attachMedia(video);heroHlsInstance.on(window.Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>hide()));heroHlsInstance.on(window.Hls.Events.ERROR,(event,data)=>{if(data&&data.fatal)hide()})}else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;video.play().catch(()=>hide())}}

function formatTime(iso){if(!iso)return'';var m=iso.match(/T(\d{2}:\d{2})/);return m?m[1]:''}

async function loadPcHomeOdds(){
  var title=document.querySelector('#pcHomeOddsTitle'),section=document.querySelector('#pcHomeOddsSection'),scroll=document.querySelector('#pcHomeOddsScroll');
  if(!section||!scroll)return;
  try{var res=await fetch('/api/public/odds/recommendations');if(!res.ok)return;var data=await res.json()}catch(e){return}
  if(!data.ok||!data.display||!data.games||data.games.length===0)return;
  if(title)title.style.display='flex';section.style.display='block';
  var html='',maxGames=Math.min(data.games.length,8);
  for(var i=0;i<maxGames;i++){var g=data.games[i];
    html+='<div class="odds-card">';
    html+='<div class="odds-card-header"><span class="odds-sport">'+leagueName(g.sport_title,g.sport_key)+'</span><span class="odds-time">'+formatTime(g.commence_time)+'</span></div>';
    html+='<div class="odds-teams">'+matchName(g.home_team,g.away_team)+'</div>';
    if(g.h2h&&g.h2h.length===2){html+='<div class="odds-row"><span class="odds-label">胜负</span><span class="odds-item">主 <b>'+g.h2h[0].price+'</b></span><span class="odds-item">客 <b>'+g.h2h[1].price+'</b></span></div>'}
    if(g.spreads&&g.spreads.length===2){html+='<div class="odds-row"><span class="odds-label">让分</span><span class="odds-item">主'+(g.spreads[0].point>0?'+':'')+g.spreads[0].point+'&nbsp;<b>'+g.spreads[0].price+'</b></span><span class="odds-item">客'+(g.spreads[1].point>0?'+':'')+g.spreads[1].point+'&nbsp;<b>'+g.spreads[1].price+'</b></span></div>'}
    if(g.totals&&g.totals.length===2){html+='<div class="odds-row"><span class="odds-label">大小</span><span class="odds-item">大 '+g.totals[0].point+'&nbsp;<b>'+g.totals[0].price+'</b></span><span class="odds-item">小 '+g.totals[1].point+'&nbsp;<b>'+g.totals[1].price+'</b></span></div>'}
    html+='<div class="odds-footer">数据来源：'+(g.bookmaker||'')+'</div>';html+='</div>';
  }
  scroll.innerHTML=html;
  // 渲染完成后触发宽度计算
  setTimeout(function(){
    var ev = {target: {dataset:{}}};
    if (typeof resizeOddsCards === 'function') resizeOddsCards();
  }, 50);
}

function renderMobileHome(){
  const cfg=state.cfg;setTimeout(bindFloatBarEvents,100);
  const heroHtml=cfg.rooms.slice(0,5).map(r=>`<a class="m-hero-card" href="${href('pages/room.html?id='+r.id)}"><img src="${asset(r.cover||'assets/img/thumb-1.svg')}" alt="${esc(r.title)}"><span class="m-hero-title">${esc(r.title)}</span></a>`).join('');
  return `<main class="mobile-page"><div class="m-hero-scroll" id="mHeroScroll">${heroHtml}</div><div class="mobile-odds-section" id="mobileOddsSection" style="display:none"><div class="m-section-title">热门赛事指数</div><div class="odds-scroll" id="mobileOddsScroll"><div class="odds-loading">加载中...</div></div><p class="odds-disclaimer" style="color:#999;font-size:10px;margin:0 12px 4px">数据仅供赛事参考</p></div><div class="m-section-title">正在热播</div><div class="m-live-grid">${filterRoomsForTab().slice(0,8).map(r=>liveCard(r)).join('')}</div><div class="m-section-title">足球直播</div><div class="m-live-grid">${cfg.rooms.filter(r=>r.category==='football').slice(0,4).map(r=>liveCard(r)).join('')}</div><div class="m-section-title">篮球直播</div><div class="m-live-grid">${cfg.rooms.filter(r=>r.category==='basketball').slice(0,4).map(r=>liveCard(r)).join('')}</div>${mobileFloatAd()}</main>`;
}

async function loadMobileOdds(){
  var section=document.querySelector('#mobileOddsSection'),scroll=document.querySelector('#mobileOddsScroll');
  if(!section||!scroll)return;
  try{var res=await fetch('/api/public/odds/recommendations');if(!res.ok){section.style.display='none';return}var data=await res.json()}catch(e){section.style.display='none';return}
  if(!data.ok||!data.display||!data.games||data.games.length===0){section.style.display='none';return}
  var html='',maxGames=Math.min(data.games.length,6);
  for(var i=0;i<maxGames;i++){var g=data.games[i];
    html+='<div class="odds-card mobile-odds-card">';
    html+='<div class="odds-card-header"><span class="odds-sport">'+leagueName(g.sport_title,g.sport_key)+'</span><span class="odds-time">'+formatTime(g.commence_time)+'</span></div>';
    html+='<div class="odds-teams">'+matchName(g.home_team,g.away_team)+'</div>';
    if(g.h2h&&g.h2h.length===2){html+='<div class="odds-row"><span class="odds-label">胜负</span><span class="odds-item">主 <b>'+g.h2h[0].price+'</b></span><span class="odds-item">客 <b>'+g.h2h[1].price+'</b></span></div>'}
    if(g.spreads&&g.spreads.length===2){html+='<div class="odds-row"><span class="odds-label">让分</span><span class="odds-item">主'+(g.spreads[0].point>0?'+':'')+g.spreads[0].point+' <b>'+g.spreads[0].price+'</b></span><span class="odds-item">客'+(g.spreads[1].point>0?'+':'')+g.spreads[1].point+' <b>'+g.spreads[1].price+'</b></span></div>'}
    html+='<div class="odds-footer">'+(g.bookmaker||'')+'</div>';html+='</div>';
  }
  scroll.innerHTML=html;
  section.style.display='block';
}
setTimeout(loadMobileOdds,500);

export function renderLive(){
  const labels=[['all','全部'],['football','足球'],['basketball','篮球'],['analysis','分析']];
  const rooms=filterRoomsForTab();setTimeout(bindFloatBarEvents,100);
  return `<main class="page-shell pc-only"><div class="container"><div class="tab-row">${labels.map(([k,t])=>`<a class="${(currentTab===k||(!new URLSearchParams(location.search).get('tab')&&k==='all'))?'is-active':''}" href="${href(`pages/live.html${k==='all'?'':`?tab=${k}`}`)}">${t}</a>`).join('')}</div><div class="live-grid">${rooms.map(r=>liveCard(r)).join('')}</div></div></main><main class="mobile-page"><div class="m-live-grid" style="padding-top:14px">${rooms.map(r=>liveCard(r)).join('')}</div>${mobileFloatAd()}</main>`;
}
