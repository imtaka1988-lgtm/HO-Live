/**
 * 海鸥直播 — 聊天室热场词包
 *
 * 安全原则：
 * 1. 不伪装真实用户，只用“海鸥小助手”。
 * 2. 不出现队名、比分、球员、具体赛事、具体时间。
 * 3. 按房间分类选择足球/篮球/分析话术，避免跨品类穿帮。
 * 4. 只在前端当前页面展示，不写入数据库。
 */
import { state } from './config.js';

let warmupTimer = null;
let lastActivityAt = Date.now();
let recentTexts = [];

const AUTHOR = '海鸥小助手';
const MIN_QUIET_MS = 60 * 1000;
const FIRST_DELAY_MIN = 35 * 1000;
const FIRST_DELAY_MAX = 75 * 1000;
const NEXT_DELAY_MIN = 90 * 1000;
const NEXT_DELAY_MAX = 180 * 1000;
const MAX_RECENT = 14;

const PACKS = {
  common: [
    '先看开局节奏，不急着下判断。',
    '这场主要看双方状态变化。',
    '先稳住，节奏还没完全出来。',
    '现在看场面变化比看感觉靠谱。',
    '这波攻防挺关键的。',
    '目前还是要看临场调整。',
    '直播画面挺清楚，先观察几分钟。',
    '感觉节奏慢慢起来了。',
    '这种场越往后越有看点。',
    '现在主要看谁先打开局面。'
  ],
  football: [
    '足球还是要看中场控制。',
    '边路推进质量挺关键。',
    '这场防线站位要重点看。',
    '定位球机会可能会影响节奏。',
    '上半场先看双方试探。',
    '节奏一快，后防压力就会上来。',
    '现在主要看谁能把球权稳住。',
    '前场逼抢如果上来，场面会好看很多。',
    '足球这种场，耐心很重要。',
    '下半场调整可能会更明显。'
  ],
  basketball: [
    '篮球主要看回合节奏。',
    '外线手感起来的话，节奏会变快。',
    '篮板保护很关键。',
    '犯规控制也要注意。',
    '轮换阵容上来后，节奏可能会变。',
    '现在主要看防守强度。',
    '这场回合数如果上来，会更好看。',
    '内线对抗挺重要。',
    '篮球还是看连续得分能力。',
    '关键时段谁稳一点很重要。'
  ],
  analysis: [
    '先看整体走势，不急着下结论。',
    '数据只能参考，临场状态更重要。',
    '这场要结合节奏一起看。',
    '现在变化还不算特别明显。',
    '先观察一段时间更稳。',
    '临场信息比单看纸面更重要。',
    '方向不用急，等节奏清楚一点。',
    '这种场要看后续变化。',
    '现在主要看双方状态是否稳定。',
    '分析还是要多看几分钟。'
  ]
};

function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function getRoom(roomId) {
  const rooms = (state.cfg && state.cfg.rooms) || [];
  return rooms.find(r => String(r.id) === String(roomId)) || {};
}

function pickText(category) {
  const pool = PACKS.common.concat(PACKS[category] || []);
  const candidates = pool.filter(t => !recentTexts.includes(t));
  const list = candidates.length ? candidates : pool;
  const text = list[rand(0, list.length - 1)] || PACKS.common[0];
  recentTexts.push(text);
  if (recentTexts.length > MAX_RECENT) recentTexts.shift();
  return text;
}

export function notifyChatActivity() {
  lastActivityAt = Date.now();
}

export function stopChatWarmup() {
  if (warmupTimer) clearTimeout(warmupTimer);
  warmupTimer = null;
}

export function startChatWarmup(roomId, appendMessage) {
  stopChatWarmup();
  lastActivityAt = Date.now();

  if (!roomId || typeof appendMessage !== 'function') return;

  const schedule = delay => {
    warmupTimer = setTimeout(tick, delay);
  };

  const tick = () => {
    const quietMs = Date.now() - lastActivityAt;
    if (quietMs >= MIN_QUIET_MS) {
      const room = getRoom(roomId);
      const category = room.category || 'common';
      appendMessage({
        role: 'assistant',
        nickname: AUTHOR,
        level: 0,
        message: pickText(category),
        createdAt: new Date().toISOString(),
        __warmup: true
      });
      lastActivityAt = Date.now();
    }
    schedule(rand(NEXT_DELAY_MIN, NEXT_DELAY_MAX));
  };

  schedule(rand(FIRST_DELAY_MIN, FIRST_DELAY_MAX));
}
