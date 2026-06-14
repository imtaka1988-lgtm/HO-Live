/**
 * 后台文案中性化
 * 不绑定具体云厂商，避免后台显示“腾讯云/阿里云”等固定平台名称。
 */

const CLOUD_SOURCE_LABEL = '云直播源';

function replaceTextNodes(root) {
  if (!root || !window.NodeFilter) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (node.nodeValue && node.nodeValue.includes('腾讯云')) {
      node.nodeValue = node.nodeValue.replace(/腾讯云/g, CLOUD_SOURCE_LABEL);
    }
    node = walker.nextNode();
  }
}

export function initAdminNeutralLabels() {
  if (document.body.dataset.page !== 'admin') return;

  const app = document.querySelector('#app');
  if (!app) return;

  replaceTextNodes(app);

  const observer = new MutationObserver(() => replaceTextNodes(app));
  observer.observe(app, {
    childList: true,
    subtree: true,
    characterData: true
  });
}
