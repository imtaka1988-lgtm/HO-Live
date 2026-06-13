/**
 * 海鸥直播 — PC 端看板娘
 * 本地轻量版：不依赖外部 CDN，不触碰播放器/客服/聊天逻辑。
 */
import { href } from './config.js';

const MESSAGES = [
  '欢迎来到海鸥直播～',
  '点直播卡片就能进房间啦。',
  '比赛先看节奏，别急着下判断。',
  '遇到卡顿可以刷新一下页面。',
  '苹果 Safari 需要手动点一下播放哦。',
  '右下角客服可以帮你处理问题。',
  '热门直播都在首页和全部直播里。',
  '祝你看球愉快～'
];

function isDesktop() {
  return window.innerWidth >= 1100;
}

function shouldSkip() {
  const page = document.body && document.body.dataset ? document.body.dataset.page : '';
  if (page === 'admin') return true;
  if (!isDesktop()) return true;
  const until = parseInt(localStorage.getItem('haiou_mascot_hide_until') || '0', 10);
  return until && Date.now() < until;
}

function pickMessage(last) {
  let msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  if (MESSAGES.length > 1 && msg === last) return pickMessage(last);
  return msg;
}

export function initMascot() {
  if (document.querySelector('#haiouMascot')) return;
  if (shouldSkip()) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href('assets/css/mascot.css');
  document.head.appendChild(link);

  const wrap = document.createElement('aside');
  wrap.id = 'haiouMascot';
  wrap.className = 'haiou-mascot';

  let current = pickMessage('');
  wrap.innerHTML = `
    <div class="haiou-mascot-inner">
      <div class="haiou-mascot-bubble" id="haiouMascotBubble">${current}</div>
      <div class="haiou-mascot-card">
        <button class="haiou-mascot-close" id="haiouMascotClose" title="隐藏看板娘">×</button>
        <img class="haiou-mascot-img" src="${href('assets/img/mascot-haio.svg')}" alt="海鸥直播看板娘">
        <div class="haiou-mascot-name"><span>海鸥</span>小助理</div>
      </div>
    </div>`;

  document.body.appendChild(wrap);

  const bubble = wrap.querySelector('#haiouMascotBubble');
  const close = wrap.querySelector('#haiouMascotClose');

  close.addEventListener('click', function () {
    localStorage.setItem('haiou_mascot_hide_until', String(Date.now() + 12 * 60 * 60 * 1000));
    wrap.classList.add('is-hidden');
  });

  wrap.addEventListener('click', function (e) {
    if (e.target === close) return;
    current = pickMessage(current);
    if (bubble) bubble.textContent = current;
  });

  setInterval(function () {
    if (!document.body.contains(wrap)) return;
    current = pickMessage(current);
    if (bubble) bubble.textContent = current;
  }, 12000);
}
