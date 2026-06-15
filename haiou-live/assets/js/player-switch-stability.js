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

export function initPlayerSwitchStability() {
  if (!LivePlayer || LivePlayer.__switchStabilityInstalled) return;
  LivePlayer.__switchStabilityInstalled = true;

  LivePlayer.__playToken = 0;
  LivePlayer.__switchLockedUntil = 0;

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

    const type = inferStreamType(stream);
    if (type === 'ts') {
      this._showPlaceholder('TS 分片地址不能直接作为直播源，请填写 m3u8 或 flv 地址');
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
      this.videoEl.play().catch(() => {
        if (isCurrentToken(this, token)) this._onStreamError(stream, token);
      });
    }

    this._updateLineButtons(idx);
  };

  LivePlayer._playHLS = function (stream, token) {
    const self = this;
    const video = this.videoEl;
    const Hls = window.Hls;

    if (isSafariOrIOS() || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.url;
      video.play().catch(function () {
        if (isCurrentToken(self, token)) self._onStreamError(stream, token);
      });
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
        video.play().catch(function () {});
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
    video.play().catch(function () {
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
        if (isCurrentToken(self, token)) self._hidePlaceholder();
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
    const next = this._findNextStream(failedStream);
    if (next) {
      this._playStream(next, this.streams.indexOf(next));
    } else {
      this._showPlaceholder('当前线路不可用，请切换线路');
    }
  };

  LivePlayer.switchTo = function (idx) {
    const now = Date.now();
    if (now < this.__switchLockedUntil) return;
    if (idx < 0 || idx >= this.streams.length) return;
    if (idx === this.currentStreamIndex) {
      this._updateLineButtons(idx);
      return;
    }
    this.__switchLockedUntil = now + 450;
    this._playStream(this.streams[idx], idx);
  };
}
