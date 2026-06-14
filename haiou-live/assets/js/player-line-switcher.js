/**
 * 稳定版播放器线路切换器
 * - 只在可用线路超过 1 条时显示
 * - 固定在播放器右上角，避开底部原生 controls
 * - 不做自动闪现/自动隐藏，避免按钮抽搐
 * - 展示短文案：主线路 / 极速线路 / 备用线路
 */

import { LivePlayer } from './player.js';

function isMobile() {
  return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent || '') || window.innerWidth <= 780;
}

function cleanName(name) {
  return String(name || '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/HLS|M3U8|FLV|低延迟|网页通用|后续启用/gi, '')
    .replace(/[-_｜|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function streamLabel(stream) {
  if (!stream) return '线路';

  var type = String(stream.type || '').toLowerCase();
  var name = cleanName(stream.name);

  if (type === 'flv' || /极速|快直播|低延迟/.test(stream.name || '')) return '极速线路';
  if (/备用|备线|副线/.test(stream.name || '')) return '备用线路';
  if (stream.default === true || /主线|主线路|高清|HLS|m3u8/i.test(stream.name || '') || type === 'hls') return '主线路';

  return name || '备用线路';
}

function displayStreamsFor(player) {
  var streams = (player.streams || []).filter(function (s) {
    return s && s.url && s.enabled !== false;
  });

  if (isMobile()) {
    streams = streams.filter(function (s) { return s.type !== 'flv'; });
  }

  return streams;
}

function closeMenu(wrapper) {
  if (wrapper) wrapper.classList.remove('is-open');
}

function updateSwitcher(player, activeIdx) {
  var wrapper = player.container && player.container.querySelector('.player-line-switcher');
  if (!wrapper) return;

  var activeStream = player.streams && player.streams[activeIdx];
  var nameEl = wrapper.querySelector('.line-current-name');

  if (nameEl) nameEl.textContent = streamLabel(activeStream);

  wrapper.querySelectorAll('.line-menu-item').forEach(function (item) {
    item.classList.toggle('is-active', parseInt(item.dataset.streamIdx, 10) === activeIdx);
  });

  closeMenu(wrapper);
}

export function initPlayerLineSwitcher() {
  if (!LivePlayer || LivePlayer.__stableLineSwitcherInstalled) return;
  LivePlayer.__stableLineSwitcherInstalled = true;

  LivePlayer._renderLineSwitcher = function () {
    var self = this;
    var container = this.container;
    if (!container) return;

    var old = container.querySelector('.player-line-switcher');
    if (old) old.remove();

    var displayStreams = displayStreamsFor(this);
    if (displayStreams.length <= 1) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'player-line-switcher';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'line-current-btn';
    btn.innerHTML = '<span class="line-current-name">线路</span>';
    wrapper.appendChild(btn);

    var menu = document.createElement('div');
    menu.className = 'line-menu';

    displayStreams.forEach(function (stream) {
      var idx = self.streams.indexOf(stream);
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'line-menu-item';
      item.dataset.streamIdx = idx;
      item.innerHTML = '<span class="line-menu-name"></span>';
      item.querySelector('.line-menu-name').textContent = streamLabel(stream);
      item.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.switchTo(parseInt(this.dataset.streamIdx, 10));
      });
      menu.appendChild(item);
    });

    wrapper.appendChild(menu);

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.toggle('is-open');
    });

    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target)) closeMenu(wrapper);
    });

    container.appendChild(wrapper);
    this._lineSwitcherEl = wrapper;
  };

  LivePlayer._updateLineButtons = function (activeIdx) {
    updateSwitcher(this, activeIdx);
  };

  LivePlayer.switchTo = function (idx) {
    if (idx >= 0 && idx < this.streams.length) {
      this._playStream(this.streams[idx], idx);
    }
  };
}
