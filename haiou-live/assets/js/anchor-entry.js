import { renderAnchorPage, bindAnchorEvents } from './anchor-page.js';

function bootAnchorPage() {
  const app = document.querySelector('#app');
  if (!app) return;
  app.innerHTML = renderAnchorPage();
  bindAnchorEvents();
}

bootAnchorPage();
