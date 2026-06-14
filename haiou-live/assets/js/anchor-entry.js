import { renderAnchorPage, bindAnchorEvents } from './anchor-page.js';
import { initAnchorUploadUi } from './anchor-upload-ui.js';

function bootAnchorPage() {
  const app = document.querySelector('#app');
  if (!app) return;
  app.innerHTML = renderAnchorPage();
  bindAnchorEvents();
  initAnchorUploadUi();
}

bootAnchorPage();
