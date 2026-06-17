import { LivePlayer } from './player.js';

function isSafariOrIOS() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
  return isIOS || isSafari;
}

function flvSupported() {
  const Flv = window.flvjs;
  return !!(Flv && Flv.isSupported && Flv.isSupported());
}

function urlPath(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, location.href).pathname.toLowerCase();
  } catch (e) {
    return raw.split('?')[0].split('#')[0].toLowerCase();
  }
}

function inferStreamType(stream) {
  const path = urlPath(stream && stream.url);
  if (/\.m3u8$/i.test(path)) return 'hls';
  if (/\.flv$/i.test(path)) return 'flv';
  if (/\.ts$/i.test(path)) return 'ts';
  return String((stream && stream.type) || 'hls').toLowerCase();
}

function normalizeStream(stream) {
  if (!stream) return stream;
  stream.type = inferStreamType(stream);
  return stream;
}

function normalizeRoomStreams(room) {
  if (!room) return;
  if (Array.isArray(room.streams)) {
    room.streams = room.streams.map(normalizeStream);
  }
  if (room.streamUrl && (!Array.isArray(room.streams) || room.streams.length === 0)) {
    room.streams = [normalizeStream({
      name: '默认线路',
      type: 'hls',
      url: room.streamUrl,
      enabled: true,
      default: true,
      priority: 1
    })];
  }
}

function isPlayableOnThisDevice(stream) {
  const type = inferStreamType(stream);
  if (type === 'ts') return false;
  if (type === 'flv') return !isSafariOrIOS() && flvSupported();
  return true;
}

function sortStreams(streams) {
  return (streams || []).slice().sort(function (a, b) {
    if (a.default && !b.default) return -1;
    if (!a.default && b.default) return 1;
    return (a.priority || 99) - (b.priority || 99);
  });
}

function resetVideo(video) {
  if (!video) return;
  try { video.pause(); } catch (e) {}
  try { video.removeAttribute('src'); } catch (e) {}
  try { video.srcObject = null; } catch (e) {}
  try { video.load(); } catch (e) {}
}

function isCurrentToken(player, token) {
  return !player.destroyed && player.__playToken === token;
}

function showLineToast(player, message) {
  const container = player && player.container;
  if (!container) return;
  let toast = container.querySelector('.player-line-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'player-line-toast';
    toast.style.cssText = 'position:absolute;left:50%;top:18px;transform:translateX(-50%);z-index:30;max-width:82%;padding:9px 14px;border-radius:999px;background:rgba(15,23,42,.88);color:#fff;font-size:12px;font-weight:800;text-align:center;box-shadow:0 10px 24px rgba(0,0,0,.22);pointer-events:none;';
    container.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(player.__lineToastTimer);
  player.__lineToastTimer = setTimeout(function () {
    if (toast) toast.style.display = 'none';
  }, 2600);
}

function markGoodStream(player) {
  if (!player) return;
  if (player.currentStreamIndex >= 0) {
    player.__lastGoodStreamIndex = player.currentStreamIndex;
  }
}

function playNativeHLS(player, stream, token) {
  const video = player.videoEl;
  if (!video) return;

  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = 'auto';
  video.src = stream.url;
  video.load();

  let hasRealError = false;
  const hideReady = function () {
    if (!hasRealError && isCurrentToken(player, token)) player._hidePlaceholder();
  };
  const onError = function () {
    hasRealError = true;
    if (isCurrentToken(player, token)) player._onStreamError(stream, token);
  };

  video.addEventListener('loadedmetadata', hideReady, { once: true });
  video.addEventListener('canplay', hideReady, { once: true });
  video.addEventListener('error', onError, { once: true });

  const promise = video.play();
  if (promise && promise.then) {
    promise.then(function () {
      if (isCurrentToken(player, token)) markGoodStream(player);
    }).catch(function () {
      if (isCurrentToken(player, token)) player._hidePlaceholder();
    });
  }
}

export function initPlayerSwitchStability() {
  if (!LivePlayer || LivePlayer.__switchStabilityInstalled) return;
  LivePlayer.__switchStabilityInstalled = true;

  const oldInit = LivePlayer.init;

  LivePlayer.__playToken = 0;
  LivePlayer.__lastGoodStreamIndex = -1;

  LivePlayer.init = function (options) {
    if (options && options.room) normalizeRoomStreams(options.room);
    const ret = oldInit.call(this, options);
    if (this.currentStreamIndex < 0 && this.streams && this.streams.length > 0) {
      const playable = this.streams.filter(isPlayableOnThisDevice);
      if (playable.length === 0) {
        const hasTs = this.streams.some(function (s) { return inferStreamType(s) === 'ts'; });
        this._showPlaceholder(hasTs ? 'TS 分片地址不能直接作为直播源，请填写 m3u8 或 flv 地址' : '当前设备不支持该播放源，请改用 m3u8 线路');
      }
    }
    return ret;
  };

  LivePlayer._getDefaultStream = function () {
    const sorted = sortStreams(this.streams).map(normalizeStream);
    const playable = sorted.filter(isPlayableOnThisDevice);

    if (isSafariOrIOS()) {
      return playable.find(function (s) { return inferStreamType(s) === 'hls'; }) || null;
    }

    return playable[0] || null;
  };

  LivePlayer._findNextStream = function (failedStream) {
    const streams = (this.streams || []).map(normalizeStream).filter(isPlayableOnThisDevice);
    const failedIdx = streams.indexOf(failedStream);
    for (let i = failedIdx + 1; i < streams.length; i++) {
      if (streams[i] !== failedStream) return streams[i];
    }
    for (let j = 0; j < failedIdx; j++) {
      if (streams[j] !== failedStream) return streams[j];
    }
    return null;
  };

  LivePlayer._destroyHls = function () {
    const hls = this.hlsInstance;
    this.hlsInstance = null;
    if (hls) {
      try { hls.detachMedia(); } catch (e) {}
      try { hls.destroy(); } catch (e) {}
    }

    const flv = this.flvInstance;
    this.flvInstance = null;
    if (flv) {
      try { flv.pause(); } catch (e) {}
      try { flv.unload(); } catch (e) {}
      try { flv.detachMediaElement(); } catch (e) {}
      try { flv.destroy(); } catch (e) {}
    }

    resetVideo(this.videoEl);
  };

  LivePlayer._playStream = function (stream, idx) {
    if (!stream || !stream.url || !this.videoEl) return;

    normalizeStream(stream);
    const type = inferStreamType(stream);
    if (type === 'ts') {
      showLineToast(this, '该线路是 TS 分片地址，不能直接播放，请填写 m3u8 或 flv 地址');
      this._updateLineButtons(this.currentStreamIndex);
      return;
    }
    if (!isPlayableOnThisDevice(stream)) {
      showLineToast(this, '当前设备不支持该线路，请改用 m3u8 线路');
      this._onStreamError(stream);
      return;
    }

    this.__playToken += 1;
    const token = this.__playToken;

    this._destroyHls();
    this.currentStreamIndex = idx;
    this._hidePlaceholder();

    stream.type = type;
    if (type === 'flv') this._playFLV(stream, token);
    else if (type === 'hls') this._playHLS(stream, token);
    else {
      this.videoEl.src = stream.url;
      this.videoEl.play().then(() => {
        if (isCurrentToken(this, token)) markGoodStream(this);
      }).catch(() => {
        if (isCurrentToken(this, token)) this._onStreamError(stream, token);
      });
    }

    this._updateLineButtons(idx);
  };

  LivePlayer._playHLS = function (stream, token) {
    const self = this;
    const video = this.videoEl;
    const Hls = window.Hls;

    if (isSafariOrIOS()) {
      playNativeHLS(this, stream, token);
      return;
    }

    if (Hls && Hls.isSupported && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60
      });
      this.hlsInstance = hls;

      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, function () {
        if (!isCurrentToken(self, token)) return;
        hls.loadSource(stream.url);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        if (!isCurrentToken(self, token)) return;
        video.play().then(function () {
          if (isCurrentToken(self, token)) markGoodStream(self);
        }).catch(function () {});
      });
      hls.on(Hls.Events.ERROR, function (event, data) {
        if (!isCurrentToken(self, token)) return;
        if (!data || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.recoverMediaError(); } catch (e) { self._onStreamError(stream, token); }
          return;
        }
        self._onStreamError(stream, token);
      });
      return;
    }

    video.src = stream.url;
    video.play().then(function () {
      if (isCurrentToken(self, token)) markGoodStream(self);
    }).catch(function () {
      if (isCurrentToken(self, token)) self._onStreamError(stream, token);
    });
  };

  LivePlayer._playFLV = function (stream, token) {
    const self = this;
    const video = this.videoEl;
    const Flv = window.flvjs;

    if (!Flv || !Flv.isSupported || !Flv.isSupported()) {
      this._onStreamError(stream, token);
      return;
    }

    try {
      const flvPlayer = Flv.createPlayer({
        type: 'flv',
        url: stream.url,
        isLive: true,
        cors: true
      }, {
        enableWorker: false,
        lazyLoad: false,
        stashInitialSize: 128
      });

      this.flvInstance = flvPlayer;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;

      flvPlayer.attachMediaElement(video);
      flvPlayer.load();
      video.play().then(function () {
        if (isCurrentToken(self, token)) {
          markGoodStream(self);
          self._hidePlaceholder();
        }
      }).catch(function () {
        if (isCurrentToken(self, token)) self._onStreamError(stream, token);
      });

      flvPlayer.on(Flv.Events.ERROR, function () {
        if (isCurrentToken(self, token)) self._onStreamError(stream, token);
      });
    } catch (e) {
      if (isCurrentToken(self, token)) self._onStreamError(stream, token);
    }
  };

  LivePlayer._onStreamError = function (failedStream, token) {
    if (this.destroyed) return;
    if (token && !isCurrentToken(this, token)) return;

    const lastGood = this.__lastGoodStreamIndex;
    if (lastGood >= 0 && this.streams[lastGood] && this.streams[lastGood] !== failedStream) {
      showLineToast(this, '该线路暂不可用，已切回可用线路');
      this._playStream(this.streams[lastGood], lastGood);
      return;
    }

    const next = this._findNextStream(failedStream);
    if (next) {
      this._playStream(next, this.streams.indexOf(next));
    } else {
      this._showPlaceholder('当前线路不可用，请切换线路');
    }
  };

  LivePlayer.switchTo = function (idx) {
    if (idx < 0 || idx >= this.streams.length) return;
    if (idx === this.currentStreamIndex) {
      this._hidePlaceholder();
      this._updateLineButtons(idx);
      return;
    }
    this._playStream(this.streams[idx], idx);
  };
}
