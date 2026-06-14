import { qs, getRoom, asset } from './config.js';

function applyRoomAnchorAvatar() {
  if (document.body.dataset.page !== 'room') return;
  const room = getRoom(qs.get('id') || '1');
  if (!room || !room.anchorAvatar) return;
  const img = document.querySelector('.player-host img');
  if (img) img.src = asset(room.anchorAvatar);
}

[300, 800, 1500].forEach(function (delay) {
  setTimeout(applyRoomAnchorAvatar, delay);
});
