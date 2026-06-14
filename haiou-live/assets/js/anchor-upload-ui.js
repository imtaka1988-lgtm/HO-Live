/**
 * 主播后台：封面和头像上传。
 */

let bound = false;

function token() { return localStorage.getItem('anchor_token') || ''; }

function fileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImage(type, file) {
  const image = await fileToDataUrl(file);
  const res = await fetch('/api/anchor/upload/' + type, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
    body: JSON.stringify({ image })
  });
  return res.json();
}

function injectControls() {
  const coverInput = document.querySelector('.anchor-room-cover');
  if (!coverInput || document.querySelector('#anchorUploadControls')) return;
  const wrap = document.createElement('div');
  wrap.id = 'anchorUploadControls';
  wrap.innerHTML = `<div class="anchor-grid" style="margin-top:10px;">
    <div class="anchor-field"><label>上传封面</label><input id="anchorCoverFile" type="file" accept="image/jpeg,image/png,image/webp"><small style="color:#999;display:block;margin-top:4px;">上传后自动更新房间封面。</small></div>
    <div class="anchor-field"><label>上传主播头像</label><input id="anchorAvatarFile" type="file" accept="image/jpeg,image/png,image/webp"><small style="color:#999;display:block;margin-top:4px;">上传后保存为当前房间主播头像。</small></div>
  </div><div class="anchor-msg" id="anchorUploadMsg"></div>`;
  coverInput.closest('.anchor-field').insertAdjacentElement('afterend', wrap);
}

async function handleUpload(type, file) {
  const msg = document.querySelector('#anchorUploadMsg');
  if (!file) return;
  if (msg) msg.textContent = '上传中...';
  const data = await uploadImage(type, file);
  if (!data || !data.ok) {
    if (msg) { msg.textContent = '上传失败：' + ((data && data.error) || '未知错误'); msg.style.color = '#dc2626'; }
    return;
  }
  if (type === 'cover' && data.cover) {
    const input = document.querySelector('.anchor-room-cover');
    if (input) input.value = data.cover;
  }
  if (msg) { msg.textContent = type === 'cover' ? '封面已上传并同步' : '头像已上传并同步'; msg.style.color = '#16a34a'; }
}

export function initAnchorUploadUi() {
  if (bound) return;
  bound = true;
  const timer = setInterval(injectControls, 500);
  setTimeout(function () { clearInterval(timer); }, 8000);

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'anchorCoverFile') handleUpload('cover', e.target.files && e.target.files[0]);
    if (e.target && e.target.id === 'anchorAvatarFile') handleUpload('avatar', e.target.files && e.target.files[0]);
  });
}
