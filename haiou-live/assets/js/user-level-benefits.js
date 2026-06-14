/**
 * 用户等级权益展示
 * 修正等级身份文案，并展示每周彩金权益。
 */

const LEVEL_TITLES = {
  1: '普通会员',
  2: '活跃会员',
  3: '进阶会员',
  4: '尊享会员',
  5: '荣耀会员'
};

const WEEKLY_BONUS = {
  1: 18,
  2: 38,
  3: 58,
  4: 88,
  5: 188
};

function injectStyle() {
  if (document.querySelector('#userLevelBenefitsStyle')) return;
  const style = document.createElement('style');
  style.id = 'userLevelBenefitsStyle';
  style.textContent = `
    .user-weekly-bonus-card {
      margin-top: 12px;
      padding: 14px;
      border-radius: 16px;
      background: linear-gradient(135deg, #111827, #3b260b 58%, #111827);
      color: #fff;
      box-shadow: 0 12px 28px rgba(249, 115, 22, .14), inset 0 0 0 1px rgba(250, 204, 21, .24);
    }
    .user-weekly-bonus-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }
    .user-weekly-bonus-head b {
      font-size: 15px;
      font-weight: 1000;
    }
    .user-weekly-bonus-head span {
      color: #fde68a;
      font-size: 13px;
      font-weight: 1000;
      white-space: nowrap;
    }
    .user-weekly-bonus-card p {
      margin: 0 0 10px;
      color: rgba(255, 255, 255, .72);
      font-size: 12px;
      line-height: 1.55;
    }
    .user-weekly-bonus-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
    }
    .user-weekly-bonus-item {
      border-radius: 10px;
      padding: 7px 5px;
      background: rgba(255, 255, 255, .08);
      text-align: center;
      color: rgba(255, 255, 255, .72);
      font-size: 11px;
      line-height: 1.35;
    }
    .user-weekly-bonus-item b {
      display: block;
      color: #fff;
      font-size: 12px;
      font-weight: 1000;
    }
    .user-weekly-bonus-item.is-current {
      background: linear-gradient(135deg, #facc15, #f97316);
      color: #111827;
      box-shadow: 0 8px 18px rgba(249, 115, 22, .24);
    }
    .user-weekly-bonus-item.is-current b {
      color: #111827;
    }
    @media (max-width: 767px) {
      .user-weekly-bonus-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
  `;
  document.head.appendChild(style);
}

function getProfile() {
  try { return JSON.parse(localStorage.getItem('user_profile') || '{}'); } catch (e) { return {}; }
}

function levelFromProfile(profile) {
  if (profile && profile.level) return Math.max(1, Math.min(5, Number(profile.level) || 1));
  const exp = Number((profile && (profile.exp !== undefined ? profile.exp : profile.coins)) || 0);
  if (exp >= 600) return 5;
  if (exp >= 300) return 4;
  if (exp >= 150) return 3;
  if (exp >= 50) return 2;
  return 1;
}

function bonusCardHtml(level) {
  const title = LEVEL_TITLES[level] || LEVEL_TITLES[1];
  const bonus = WEEKLY_BONUS[level] || WEEKLY_BONUS[1];
  const items = [1, 2, 3, 4, 5].map(function (lv) {
    return `<div class="user-weekly-bonus-item ${lv === level ? 'is-current' : ''}"><b>LV.${lv}</b>${WEEKLY_BONUS[lv]} 彩金</div>`;
  }).join('');
  return `<section class="user-weekly-bonus-card" data-user-weekly-bonus>
    <div class="user-weekly-bonus-head"><b>每周彩金权益</b><span>LV.${level} ${title} · ${bonus} 彩金</span></div>
    <p>等级越高，每周可领取的彩金越高。领取入口和领取记录下一步开放。</p>
    <div class="user-weekly-bonus-grid">${items}</div>
  </section>`;
}

let applying = false;

function applyLevelBenefits() {
  if (applying) return;
  applying = true;
  try {
    const profile = getProfile();
    const level = levelFromProfile(profile);
    const title = LEVEL_TITLES[level] || LEVEL_TITLES[1];

    document.querySelectorAll('.user-level-badge').forEach(function (el) {
      el.textContent = 'LV.' + level + ' ' + title;
    });

    document.querySelectorAll('[data-level-progress]').forEach(function (card) {
      if (card.nextElementSibling && card.nextElementSibling.matches('[data-user-weekly-bonus]')) {
        card.nextElementSibling.outerHTML = bonusCardHtml(level);
      } else {
        card.insertAdjacentHTML('afterend', bonusCardHtml(level));
      }
    });
  } finally {
    applying = false;
  }
}

export function initUserLevelBenefits() {
  if (document.body.dataset.page !== 'user') return;
  if (!localStorage.getItem('token')) return;
  injectStyle();
  applyLevelBenefits();
  setTimeout(applyLevelBenefits, 500);
  setTimeout(applyLevelBenefits, 1500);
}
