/**
 * 统一注入移动端桌面图标 / PWA manifest。
 * 让首页、直播间、后台等所有页面都使用同一套图标。
 */

function upsertLink(rel, href, attrs = {}) {
  let el = document.querySelector(`link[rel="${rel}"][href="${href}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    el.href = href;
    document.head.appendChild(el);
  }

  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
}

function upsertMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

export function initAppIcons() {
  upsertLink('icon', '/assets/icons/app-icon.svg', { type: 'image/svg+xml' });
  upsertLink('apple-touch-icon', '/assets/icons/app-icon.svg');
  upsertLink('manifest', '/manifest.webmanifest');

  upsertMeta('theme-color', '#ff6a00');
  upsertMeta('application-name', '海鸥直播');
  upsertMeta('apple-mobile-web-app-title', '海鸥直播');
  upsertMeta('apple-mobile-web-app-capable', 'yes');
  upsertMeta('mobile-web-app-capable', 'yes');
}
