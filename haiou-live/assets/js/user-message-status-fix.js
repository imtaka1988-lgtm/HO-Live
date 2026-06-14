/**
 * 用户中心站内信状态兜底修复
 * 避免 PC 端消息区一直显示“加载中”。
 */

function isLoading(el) {
  return !!el && /加载中|正在检查/.test(el.textContent || '');
}

function copyIfReady(from, to) {
  if (!from || !to) return false;
  if (isLoading(from) || !isLoading(to)) return false;
  to.innerHTML = from.innerHTML;
  return true;
}

export function initUserMessageStatusFix() {
  if (document.body.dataset.page !== 'user') return;

  let times = 0;
  const timer = setInterval(function () {
    times += 1;

    const mobileList = document.querySelector('#userMessageList');
    const pcList = document.querySelector('#pcUserMessageList');
    const mobileCount = document.querySelector('#userMessageCount');
    const pcCount = document.querySelector('#pcUserMessageCount');
    const mobileHint = document.querySelector('#userMessageHint');

    copyIfReady(mobileList, pcList);

    if (mobileCount && pcCount && !isLoading(mobileCount) && isLoading(pcCount)) {
      pcCount.textContent = mobileCount.textContent;
    }

    if (mobileHint && mobileCount && !isLoading(mobileHint) && isLoading(mobileCount)) {
      mobileCount.textContent = mobileHint.textContent.includes('失败') ? '加载失败' : '暂无';
    }

    if (times >= 12) {
      const fallbackHtml = '<div class="follow-empty-box"><b>暂无系统站内信</b><span>后续系统通知、活动提醒会在这里显示。</span></div>';
      if (mobileList && isLoading(mobileList)) mobileList.innerHTML = fallbackHtml;
      if (pcList && isLoading(pcList)) pcList.innerHTML = fallbackHtml;
      if (mobileCount && isLoading(mobileCount)) mobileCount.textContent = '暂无';
      if (pcCount && isLoading(pcCount)) pcCount.textContent = '暂无';
      if (mobileHint && isLoading(mobileHint)) mobileHint.textContent = '暂无系统通知';
      clearInterval(timer);
      return;
    }

    if ((!mobileList || !isLoading(mobileList)) && (!pcList || !isLoading(pcList))) {
      clearInterval(timer);
    }
  }, 500);
}
