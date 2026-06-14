/**
 * 用户头像上传
 * 支持选择、预览、保存到后端。
 */

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

let selectedAvatarFile = null;
let selectedAvatarDataUrl = '';
let savingAvatar = false;

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
    .user-avatar-preview-btn,
    .user-avatar-save-btn {
      border: 0;
      border-radius: 999px;
      padding: 7px 13px;
      font-size: 12px;
      font-weight: 900;
    }
    .user-avatar-preview-btn {
      background: linear-gradient(135deg, #111827, #3b260b 58%, #111827);
      color: #fde68a;
      box-shadow: inset 0 0 0 1px rgba(250, 204, 21, .28), 0 8px 18px rgba(249, 115, 22, .18);
    }
    .user-avatar-save-btn {
      display: none;
      background: linear-gradient(135deg, #facc15, #f97316);
      color: #111827;
      box-shadow: 0 8px 18px rgba(249, 115, 22, .20);
    }
    .user-avatar-save-btn.is-show {
      display: inline-flex;
      align-items: center;
    }
    .user-avatar-save-btn:disabled {
      opacity: .62;
      cursor: not-allowed;
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

function saveButtons() {
  return Array.from(document.querySelectorAll('.user-avatar-save-btn'));
}

function setHint(text, type) {
  document.querySelectorAll('.user-avatar-preview-hint').forEach(function (el) {
    el.textContent = text;
    el.classList.toggle('user-avatar-preview-ok', type === 'ok');
    el.classList.toggle('user-avatar-preview-error', type === 'error');
  });
}

function setSaveVisible(visible) {
  saveButtons().forEach(function (btn) {
    btn.classList.toggle('is-show', !!visible);
  });
}

function fileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(String(reader.result || '')); };
    reader.onerror = function () { reject(new Error('图片读取失败')); };
    reader.readAsDataURL(file);
  });
}

async function handleFile(file) {
  selectedAvatarFile = null;
  selectedAvatarDataUrl = '';
  setSaveVisible(false);

  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) {
    setHint('只支持 jpg、png、webp 图片', 'error');
    return;
  }
  if (file.size > MAX_AVATAR_SIZE) {
    setHint('图片不能超过 2MB', 'error');
    return;
  }

  try {
    selectedAvatarDataUrl = await fileToDataUrl(file);
    selectedAvatarFile = file;
    avatarImages().forEach(function (img) {
      img.src = selectedAvatarDataUrl;
    });
    setSaveVisible(true);
    setHint('已预览，点击“保存头像”后生效', 'ok');
  } catch (e) {
    setHint(e.message || '图片读取失败', 'error');
  }
}

function updateStoredAvatar(avatar) {
  try {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    profile.avatar = avatar;
    localStorage.setItem('user_profile', JSON.stringify(profile));
  } catch (e) {}
}

async function saveAvatar() {
  if (savingAvatar) return;
  if (!selectedAvatarFile || !selectedAvatarDataUrl) {
    setHint('请先选择头像图片', 'error');
    return;
  }

  const token = localStorage.getItem('token') || '';
  if (!token) {
    setHint('请先登录后再保存头像', 'error');
    return;
  }

  savingAvatar = true;
  saveButtons().forEach(function (btn) {
    btn.disabled = true;
    btn.textContent = '保存中...';
  });
  setHint('正在上传头像...', 'ok');

  try {
    const res = await fetch('/api/user/avatar', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: selectedAvatarDataUrl })
    });
    const data = await res.json();
    if (!data || !data.ok || !data.avatar) {
      throw new Error((data && data.error) || '头像保存失败');
    }

    updateStoredAvatar(data.avatar);
    avatarImages().forEach(function (img) {
      img.src = data.avatar;
    });
    selectedAvatarFile = null;
    selectedAvatarDataUrl = '';
    setSaveVisible(false);
    setHint('头像已保存，刷新后仍会保留', 'ok');
  } catch (e) {
    setHint(e.message || '头像保存失败，请稍后重试', 'error');
  } finally {
    savingAvatar = false;
    saveButtons().forEach(function (btn) {
      btn.disabled = false;
      btn.textContent = '保存头像';
    });
  }
}

function addControls(target, input) {
  if (!target || target.querySelector('.user-avatar-preview-actions')) return;
  const actions = document.createElement('div');
  actions.className = 'user-avatar-preview-actions';
  actions.innerHTML = '<button class="user-avatar-preview-btn" type="button">更换头像预览</button><button class="user-avatar-save-btn" type="button">保存头像</button><span class="user-avatar-preview-hint">支持 jpg/png/webp，最大 2MB</span>';
  actions.querySelector('.user-avatar-preview-btn').addEventListener('click', function () {
    input.click();
  });
  actions.querySelector('.user-avatar-save-btn').addEventListener('click', saveAvatar);
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
