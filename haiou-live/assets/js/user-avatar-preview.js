/**
 * 用户头像本地预览
 * 第一步只预览，不上传、不改数据库。
 */

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function injectStyle() {
  if (document.querySelector('#userAvatarPreviewStyle')) return;
  const style = document.createElement('style');
  style.id = 'userAvatarPreviewStyle';
  style.textContent = `
    .user-avatar-preview-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .user-avatar-preview-btn {
      border: 0;
      border-radius: 999px;
      padding: 7px 13px;
      background: linear-gradient(135deg, #111827, #3b260b 58%, #111827);
      color: #fde68a;
      font-size: 12px;
      font-weight: 900;
      box-shadow: inset 0 0 0 1px rgba(250, 204, 21, .28), 0 8px 18px rgba(249, 115, 22, .18);
    }
    .user-avatar-preview-hint {
      color: #888;
      font-size: 12px;
      line-height: 1.5;
    }
    .user-avatar-preview-ok {
      color: #059669;
      font-weight: 800;
    }
    .user-avatar-preview-error {
      color: #dc2626;
      font-weight: 800;
    }
  `;
  document.head.appendChild(style);
}

function avatarImages() {
  return Array.from(document.querySelectorAll('.user-center-profile img, .user-center-pc-head img'));
}

function setHint(text, type) {
  document.querySelectorAll('.user-avatar-preview-hint').forEach(function (el) {
    el.textContent = text;
    el.classList.toggle('user-avatar-preview-ok', type === 'ok');
    el.classList.toggle('user-avatar-preview-error', type === 'error');
  });
}

function handleFile(file) {
  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) {
    setHint('只支持 jpg、png、webp 图片', 'error');
    return;
  }
  if (file.size > MAX_AVATAR_SIZE) {
    setHint('图片不能超过 2MB', 'error');
    return;
  }

  const url = URL.createObjectURL(file);
  avatarImages().forEach(function (img) {
    img.src = url;
  });
  setHint('已预览，下一步再接保存上传', 'ok');
}

function addControls(target, input) {
  if (!target || target.querySelector('.user-avatar-preview-actions')) return;
  const actions = document.createElement('div');
  actions.className = 'user-avatar-preview-actions';
  actions.innerHTML = '<button class="user-avatar-preview-btn" type="button">更换头像预览</button><span class="user-avatar-preview-hint">支持 jpg/png/webp，最大 2MB</span>';
  actions.querySelector('button').addEventListener('click', function () {
    input.click();
  });
  target.appendChild(actions);
}

export function initUserAvatarPreview() {
  if (document.body.dataset.page !== 'user') return;
  if (!localStorage.getItem('token')) return;
  const imgs = avatarImages();
  if (!imgs.length) return;
  injectStyle();

  let input = document.querySelector('#userAvatarPreviewInput');
  if (!input) {
    input = document.createElement('input');
    input.id = 'userAvatarPreviewInput';
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      handleFile(input.files && input.files[0]);
      input.value = '';
    });
  }

  addControls(document.querySelector('.user-center-profile'), input);
  addControls(document.querySelector('.user-center-pc-head'), input);
}
